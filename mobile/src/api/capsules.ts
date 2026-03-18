import { Platform } from "react-native";
import {
  Capsule,
  CapsuleItemCounts,
  CapsulePhoto,
  CapsuleContribution,
  CapsuleType,
  GoalItem,
  NewCapsule,
} from "../types";
import { apiUrl } from "./client";
import { authorizedRequest, currentSession } from "./session";

type ApiCapsule = {
  id: string;
  title: string;
  subtitle: string;
  capsule_type: CapsuleType;
  recipient: string;
  open_at: string;
  status: "draft" | "sealed" | "opened";
  accent: string;
  emoji: string;
  reminder_enabled: boolean;
  item_counts: Partial<CapsuleItemCounts>;
  integrity_hash: string | null;
  opened_at: string | null;
  created_at: string;
  is_shared: boolean;
  owner_id: string;
  is_owner: boolean;
  collaborative: boolean;
};

type ApiItem = {
  id: string;
  item_type: "letter" | "goal" | "prediction" | "photo";
  position: number;
  body: string | null;
  metadata: Record<string, unknown>;
  media_path?: string;
  contributor?: { id: string; display_name: string; username: string };
};

type RevealResponse = {
  data: { capsule: ApiCapsule; items: ApiItem[]; trusted_time: string };
  authority: "database";
};

const EMPTY_COUNTS: CapsuleItemCounts = {
  letter: 0,
  goals: 0,
  predictions: 0,
  photos: 0,
};

function normalizeCounts(value: Partial<CapsuleItemCounts> | null): CapsuleItemCounts {
  return {
    letter: Number(value?.letter ?? 0),
    goals: Number(value?.goals ?? 0),
    predictions: Number(value?.predictions ?? 0),
    photos: Number(value?.photos ?? 0),
  };
}

function mapCapsule(row: ApiCapsule): Capsule {
  return {
    id: row.id,
    remoteId: row.id,
    title: row.title,
    subtitle: row.subtitle,
    type: row.capsule_type,
    recipient: row.recipient,
    letter: "",
    goals: [],
    predictions: [],
    photos: [],
    createdAt: row.created_at,
    unlockAt: row.open_at,
    openedAt: row.opened_at ?? undefined,
    status: row.status,
    accent: row.accent,
    emoji: row.emoji,
    reminderEnabled: row.reminder_enabled,
    integrityHash: row.integrity_hash ?? undefined,
    syncStatus: "synced",
    contentLoaded: false,
    itemCounts: normalizeCounts(row.item_counts),
    isShared: row.is_shared,
    ownerId: row.owner_id,
    isOwner: row.is_owner,
    collaborative: row.collaborative,
    contributions: [],
  };
}

function extensionForUri(uri: string) {
  const match = /\.([a-zA-Z0-9]+)(?:\?|$)/.exec(uri);
  const extension = match?.[1]?.toLowerCase();
  return extension && ["jpg", "jpeg", "png", "webp", "heic", "heif"].includes(extension)
    ? extension
    : "jpg";
}

function mimeForExtension(extension: string) {
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "heic") return "image/heic";
  if (extension === "heif") return "image/heif";
  return "image/jpeg";
}

export async function listCapsules() {
  const response = await authorizedRequest<{ data: ApiCapsule[] }>("/v1/capsules");
  return response.data.map(mapCapsule);
}

export async function createCapsule(input: NewCapsule) {
  const form = new FormData();
  form.append(
    "payload",
    JSON.stringify({
      title: input.title,
      subtitle: input.subtitle,
      capsule_type: input.type,
      recipient: input.recipient,
      letter: input.letter,
      goals: input.goals,
      predictions: input.predictions,
      photos: input.photos.map(({ id, width, height }) => ({ id, width, height })),
      open_at: input.unlockAt,
      accent: input.accent,
      emoji: input.emoji,
      reminder_enabled: input.reminderEnabled,
      shared_with_usernames: input.sharedWithUsernames ?? [],
      collaborative: input.collaborative ?? false,
    }),
  );

  for (const photo of input.photos) {
    const extension = extensionForUri(photo.uri);
    const type = mimeForExtension(extension);
    const name = `${photo.id}.${extension}`;
    if (Platform.OS === "web") {
      const response = await fetch(photo.uri);
      form.append("photos", await response.blob(), name);
    } else {
      form.append("photos", { uri: photo.uri, type, name } as unknown as Blob);
    }
  }

  const response = await authorizedRequest<{ data: ApiCapsule }>("/v1/capsules", {
    method: "POST",
    body: form,
  });
  return mapCapsule(response.data);
}

export async function revealCapsule(capsuleId: string) {
  const response = await authorizedRequest<RevealResponse>(
    `/v1/capsules/${capsuleId}/reveal`,
    { method: "POST" },
  );
  const { capsule, items, trusted_time: trustedTime } = response.data;
  const goals: GoalItem[] = items
    .filter((item) => item.item_type === "goal" && item.body)
    .map((item) => ({
      id: item.id,
      text: item.body!,
      completed: item.metadata.completed === true,
    }));
  const predictions = items
    .filter((item) => item.item_type === "prediction" && item.body)
    .map((item) => item.body!);
  const photos: CapsulePhoto[] = items
    .filter((item) => item.item_type === "photo" && item.media_path)
    .map((item) => ({
      id: item.id,
      uri: apiUrl(item.media_path!),
      width: typeof item.metadata.width === "number" ? item.metadata.width : undefined,
      height: typeof item.metadata.height === "number" ? item.metadata.height : undefined,
      requiresAuth: true,
    }));
  const contributions: CapsuleContribution[] = items
    .filter((item) => item.metadata.collaborative === true && item.body)
    .map((item) => ({
      id: item.id,
      body: item.body!,
      contributor: item.contributor
        ? {
            id: item.contributor.id,
            displayName: item.contributor.display_name,
            username: item.contributor.username,
          }
        : undefined,
    }));
  return {
    ...mapCapsule(capsule),
    letter:
      items.find(
        (item) => item.item_type === "letter" && item.metadata.collaborative !== true,
      )?.body ?? "",
    goals,
    predictions,
    photos,
    contributions,
    status: "opened" as const,
    openedAt: capsule.opened_at ?? trustedTime,
    contentLoaded: true,
  };
}

export async function loadCollaborativeDraft(capsuleId: string) {
  const response = await authorizedRequest<{
    data: { capsule: ApiCapsule; items: ApiItem[] };
  }>(`/v1/capsules/${capsuleId}/draft`);
  const { capsule, items } = response.data;
  const collaborativeItems = items.filter((item) => item.metadata.collaborative === true);
  const contributions: CapsuleContribution[] = collaborativeItems
    .filter((item) => item.body)
    .map((item) => ({
      id: item.id,
      body: item.body!,
      contributor: item.contributor
        ? {
            id: item.contributor.id,
            displayName: item.contributor.display_name,
            username: item.contributor.username,
          }
        : undefined,
    }));
  const photos: CapsulePhoto[] = items
    .filter((item) => item.item_type === "photo" && item.media_path)
    .map((item) => ({
      id: item.id,
      uri: apiUrl(item.media_path!),
      width: typeof item.metadata.width === "number" ? item.metadata.width : undefined,
      height: typeof item.metadata.height === "number" ? item.metadata.height : undefined,
      requiresAuth: true,
    }));
  return {
    ...mapCapsule(capsule),
    letter:
      items.find(
        (item) => item.item_type === "letter" && item.metadata.collaborative !== true,
      )?.body ?? "",
    goals: items
      .filter((item) => item.item_type === "goal" && item.body)
      .map((item) => ({ id: item.id, text: item.body!, completed: false })),
    predictions: items
      .filter((item) => item.item_type === "prediction" && item.body)
      .map((item) => item.body!),
    photos,
    contributions,
    contentLoaded: true,
  };
}

export async function addCapsuleContribution(capsuleId: string, body: string) {
  const response = await authorizedRequest<{ data: ApiItem }>(
    `/v1/capsules/${capsuleId}/contributions`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    },
  );
  const item = response.data;
  return {
    id: item.id,
    body: item.body ?? body,
    contributor: item.contributor
      ? {
          id: item.contributor.id,
          displayName: item.contributor.display_name,
          username: item.contributor.username,
        }
      : undefined,
  } satisfies CapsuleContribution;
}

export async function sealCollaborativeCapsule(capsuleId: string) {
  const response = await authorizedRequest<{ data: ApiCapsule }>(
    `/v1/capsules/${capsuleId}/seal`,
    { method: "POST" },
  );
  return mapCapsule(response.data);
}

export function mediaAuthorizationHeader() {
  const active = currentSession();
  return active ? { Authorization: `Bearer ${active.accessToken}` } : undefined;
}

export function countsForCapsule(capsule: Capsule): CapsuleItemCounts {
  return capsule.itemCounts ?? {
    ...EMPTY_COUNTS,
    letter: capsule.letter ? 1 : 0,
    goals: capsule.goals.length,
    predictions: capsule.predictions.length,
    photos: capsule.photos.length,
  };
}
