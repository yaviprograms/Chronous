import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  addCapsuleContribution as addContributionRequest,
  createCapsule as createCapsuleRequest,
  listCapsules,
  loadCollaborativeDraft,
  revealCapsule,
  sealCollaborativeCapsule,
} from "../api/capsules";
import {
  getCurrentAccount,
  restoreSession,
  signIn as signInRequest,
  signOut as signOutRequest,
  signUp as signUpRequest,
  subscribeSession,
} from "../api/session";
import { scheduleUnlockReminder } from "../lib/notifications";
import { AuthSession, Capsule, CapsuleContribution, NewCapsule, UserProfile } from "../types";

const CACHE_PREFIX = "@chronous/capsules/v2";

type CapsuleContextValue = {
  capsules: Capsule[];
  isLoading: boolean;
  isAuthReady: boolean;
  session: AuthSession | null;
  profile: UserProfile | null;
  isSyncing: boolean;
  apiError: string | null;
  addCapsule: (input: NewCapsule) => Promise<Capsule>;
  openCapsule: (id: string) => Promise<void>;
  toggleGoal: (capsuleId: string, goalId: string) => Promise<void>;
  addContribution: (capsuleId: string, body: string) => Promise<CapsuleContribution>;
  sealDraft: (capsuleId: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (displayName: string, email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
};

const CapsuleContext = createContext<CapsuleContextValue | null>(null);

function cacheKey(userId: string) {
  return `${CACHE_PREFIX}/${userId}`;
}

function mergeCapsules(current: Capsule[], remote: Capsule[]) {
  const cachedById = new Map(current.map((capsule) => [capsule.remoteId ?? capsule.id, capsule]));
  return remote.map((capsule) => {
    const cached = cachedById.get(capsule.remoteId ?? capsule.id);
    if (!cached?.contentLoaded || capsule.status === "sealed") return capsule;
    return {
      ...capsule,
      letter: cached.letter,
      goals: cached.goals,
      predictions: cached.predictions,
      photos: cached.photos,
      contributions: cached.contributions,
      contentLoaded: true,
    };
  });
}

export function CapsuleProvider({ children }: PropsWithChildren) {
  const [capsules, setCapsules] = useState<Capsule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const loadAccount = useCallback(async (active: AuthSession) => {
    const cached = await AsyncStorage.getItem(cacheKey(active.user.id));
    if (cached) setCapsules(JSON.parse(cached));
    const [{ profile: accountProfile }, remote] = await Promise.all([
      getCurrentAccount(),
      listCapsules(),
    ]);
    setProfile(accountProfile);
    setCapsules((current) => mergeCapsules(current, remote));
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeSession((active) => {
      setSession(active);
      if (!active) {
        setProfile(null);
        setCapsules([]);
      }
    });
    async function hydrate() {
      try {
        const active = await restoreSession();
        setSession(active);
        if (active) await loadAccount(active);
      } catch (error) {
        setApiError(error instanceof Error ? error.message : "Could not restore your account.");
      } finally {
        setIsLoading(false);
        setIsAuthReady(true);
      }
    }
    void hydrate();
    return unsubscribe;
  }, [loadAccount]);

  useEffect(() => {
    if (!session || isLoading) return;
    void AsyncStorage.setItem(cacheKey(session.user.id), JSON.stringify(capsules));
  }, [capsules, isLoading, session]);

  const syncNow = useCallback(async () => {
    if (!session) return;
    setIsSyncing(true);
    setApiError(null);
    try {
      await loadAccount(session);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Sync failed.");
      throw error;
    } finally {
      setIsSyncing(false);
    }
  }, [loadAccount, session]);

  const addCapsule = useCallback(async (input: NewCapsule) => {
    setApiError(null);
    try {
      const remote = await createCapsuleRequest(input);
      let created: Capsule = {
        ...remote,
        ...input,
        id: remote.id,
        remoteId: remote.id,
        status: remote.status,
        createdAt: remote.createdAt,
        integrityHash: remote.integrityHash,
        contentLoaded: true,
        syncStatus: "synced",
        itemCounts: {
          letter: input.letter ? 1 : 0,
          goals: input.goals.length,
          predictions: input.predictions.length,
          photos: input.photos.length,
        },
      };
      if (created.status === "sealed") {
        try {
          const reminderId = await scheduleUnlockReminder(created);
          created = { ...created, reminderId };
        } catch {
          // Notification permission does not affect the server-side capsule.
        }
      }
      setCapsules((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      return created;
    } catch (error) {
      const message = error instanceof Error ? error.message : "The capsule could not be created.";
      setApiError(message);
      throw new Error(message);
    }
  }, []);

  const openCapsule = useCallback(
    async (id: string) => {
      const target = capsules.find((capsule) => capsule.id === id);
      if (!target) return;
      const opened =
        target.status === "draft"
          ? await loadCollaborativeDraft(target.remoteId ?? target.id)
          : await revealCapsule(target.remoteId ?? target.id);
      setCapsules((current) =>
        current.map((capsule) =>
          capsule.id === id
            ? { ...capsule, ...opened, id: capsule.id, remoteId: opened.remoteId ?? opened.id }
            : capsule,
        ),
      );
    },
    [capsules],
  );

  const addContribution = useCallback(async (capsuleId: string, body: string) => {
    const contribution = await addContributionRequest(capsuleId, body);
    setCapsules((current) =>
      current.map((capsule) =>
        capsule.id === capsuleId
          ? {
              ...capsule,
              contributions: [...(capsule.contributions ?? []), contribution],
              contentLoaded: true,
            }
          : capsule,
      ),
    );
    return contribution;
  }, []);

  const sealDraft = useCallback(async (capsuleId: string) => {
    const sealed = await sealCollaborativeCapsule(capsuleId);
    setCapsules((current) =>
      current.map((capsule) =>
        capsule.id === capsuleId
          ? {
              ...capsule,
              ...sealed,
              letter: "",
              goals: [],
              predictions: [],
              photos: [],
              contributions: [],
              contentLoaded: false,
            }
          : capsule,
      ),
    );
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      setApiError(null);
      const active = await signInRequest(email, password);
      if (!active) throw new Error("Sign-in did not return a session.");
      setSession(active);
      await loadAccount(active);
    },
    [loadAccount],
  );

  const signUp = useCallback(
    async (displayName: string, email: string, password: string) => {
      setApiError(null);
      const result = await signUpRequest(displayName, email, password);
      if (result.session) {
        setSession(result.session);
        await loadAccount(result.session);
      }
      return Boolean(result.session);
    },
    [loadAccount],
  );

  const signOut = useCallback(async () => {
    await signOutRequest();
    setSession(null);
    setProfile(null);
    setApiError(null);
    setCapsules([]);
  }, []);

  const toggleGoal = useCallback((capsuleId: string, goalId: string) => {
    setCapsules((current) =>
      current.map((capsule) =>
        capsule.id === capsuleId
          ? {
              ...capsule,
              goals: capsule.goals.map((goal) =>
                goal.id === goalId ? { ...goal, completed: !goal.completed } : goal,
              ),
            }
          : capsule,
      ),
    );
    return Promise.resolve();
  }, []);

  const value = useMemo(
    () => ({
      capsules,
      isLoading,
      isAuthReady,
      session,
      profile,
      isSyncing,
      apiError,
      addCapsule,
      openCapsule,
      toggleGoal,
      addContribution,
      sealDraft,
      signIn,
      signUp,
      signOut,
      syncNow,
    }),
    [
      addCapsule,
      addContribution,
      apiError,
      capsules,
      isAuthReady,
      isLoading,
      isSyncing,
      openCapsule,
      profile,
      session,
      signIn,
      signOut,
      signUp,
      sealDraft,
      syncNow,
      toggleGoal,
    ],
  );

  return <CapsuleContext.Provider value={value}>{children}</CapsuleContext.Provider>;
}

export function useCapsules() {
  const context = useContext(CapsuleContext);
  if (!context) throw new Error("useCapsules must be used inside CapsuleProvider");
  return context;
}
