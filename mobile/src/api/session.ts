import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { AuthSession, UserProfile } from "../types";
import { ApiError, apiRequest, jsonRequest } from "./client";

const SESSION_KEY = "chronous.auth.session.v1";
const listeners = new Set<(session: AuthSession | null) => void>();
let session: AuthSession | null = null;
let loaded = false;
let refreshInFlight: Promise<AuthSession | null> | null = null;

type ApiSession = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  token_type: string;
  user: { id: string; email: string | null };
};

type ApiAuthResponse = {
  session: ApiSession | null;
  confirmation_required: boolean;
};

type MeResponse = {
  user: { id: string; email: string | null };
  profile: { id: string; display_name: string; username: string };
};

type MessageResponse = { message: string };

function mapSession(value: ApiSession): AuthSession {
  return {
    accessToken: value.access_token,
    refreshToken: value.refresh_token,
    expiresAt: value.expires_at,
    tokenType: value.token_type,
    user: value.user,
  };
}

async function readStoredSession() {
  const value =
    Platform.OS === "web"
      ? await AsyncStorage.getItem(SESSION_KEY)
      : await SecureStore.getItemAsync(SESSION_KEY);
  return value ? (JSON.parse(value) as AuthSession) : null;
}

async function writeStoredSession(value: AuthSession | null) {
  if (Platform.OS === "web") {
    if (value) await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(value));
    else await AsyncStorage.removeItem(SESSION_KEY);
    return;
  }
  if (value) {
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(value), {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
  } else {
    await SecureStore.deleteItemAsync(SESSION_KEY);
  }
}

async function updateSession(value: AuthSession | null) {
  session = value;
  loaded = true;
  await writeStoredSession(value);
  listeners.forEach((listener) => listener(value));
}

export function subscribeSession(listener: (value: AuthSession | null) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function restoreSession() {
  if (!loaded) {
    session = await readStoredSession();
    loaded = true;
  }
  if (session && session.expiresAt <= Math.floor(Date.now() / 1000) + 60) {
    return refreshSession();
  }
  return session;
}

export function currentSession() {
  return session;
}

async function refreshSession(): Promise<AuthSession | null> {
  if (!session) return null;
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const result = await jsonRequest<ApiAuthResponse>("/v1/auth/refresh", {
        refresh_token: session!.refreshToken,
      });
      const refreshed = result.session ? mapSession(result.session) : null;
      await updateSession(refreshed);
      return refreshed;
    } catch {
      await updateSession(null);
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export async function authorizedRequest<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  const active = await restoreSession();
  if (!active) throw new ApiError("Your session expired. Sign in again.", 401);
  try {
    return await apiRequest<T>(path, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${active.accessToken}` },
    });
  } catch (error) {
    if (retry && error instanceof ApiError && error.status === 401) {
      const refreshed = await refreshSession();
      if (refreshed) return authorizedRequest<T>(path, init, false);
    }
    throw error;
  }
}

export async function signIn(email: string, password: string) {
  const result = await jsonRequest<ApiAuthResponse>("/v1/auth/sign-in", { email, password });
  const active = result.session ? mapSession(result.session) : null;
  await updateSession(active);
  return active;
}

export async function signUp(displayName: string, email: string, password: string) {
  const result = await jsonRequest<ApiAuthResponse>("/v1/auth/sign-up", {
    display_name: displayName,
    email,
    password,
  });
  const active = result.session ? mapSession(result.session) : null;
  await updateSession(active);
  return { session: active, confirmationRequired: result.confirmation_required };
}

export async function requestPasswordRecovery(email: string) {
  return jsonRequest<MessageResponse>("/v1/auth/recover-password", { email });
}

export async function signOut() {
  const active = await restoreSession();
  try {
    if (active) {
      await authorizedRequest<void>("/v1/auth/sign-out", { method: "POST" }, false);
    }
  } finally {
    await updateSession(null);
  }
}

export async function getCurrentAccount(): Promise<{
  session: AuthSession;
  profile: UserProfile;
}> {
  const active = await restoreSession();
  if (!active) throw new ApiError("Your session expired. Sign in again.", 401);
  const data = await authorizedRequest<MeResponse>("/v1/auth/me");
  return {
    session: { ...active, user: data.user },
    profile: {
      id: data.profile.id,
      displayName: data.profile.display_name,
      username: data.profile.username,
    },
  };
}
