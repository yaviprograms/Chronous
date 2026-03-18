import { UserProfile } from '../types';
import { authorizedRequest } from './session';

export type Friendship = {
  id: string;
  status: 'pending' | 'accepted';
  direction: 'incoming' | 'outgoing';
  profile: UserProfile;
  createdAt: string;
  respondedAt?: string;
};

type ApiProfile = { id: string; display_name: string; username: string };
type ApiFriendship = {
  id: string;
  status: Friendship['status'];
  direction: Friendship['direction'];
  profile: ApiProfile;
  created_at: string;
  responded_at: string | null;
};

function profile(row: ApiProfile): UserProfile {
  return { id: row.id, displayName: row.display_name, username: row.username };
}

export async function listFriends(): Promise<Friendship[]> {
  const rows = await authorizedRequest<ApiFriendship[]>('/v1/friends');
  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    direction: row.direction,
    profile: profile(row.profile),
    createdAt: row.created_at,
    respondedAt: row.responded_at ?? undefined,
  }));
}

export async function searchPeople(query: string): Promise<UserProfile[]> {
  const rows = await authorizedRequest<ApiProfile[]>(
    `/v1/friends/search?query=${encodeURIComponent(query.replace(/^@/, ''))}`,
  );
  return rows.map(profile);
}

export async function sendFriendRequest(username: string) {
  await authorizedRequest('/v1/friends/requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  });
}

export async function acceptFriendRequest(friendshipId: string) {
  await authorizedRequest(`/v1/friends/${friendshipId}/accept`, { method: 'POST' });
}

export async function removeFriendship(friendshipId: string) {
  await authorizedRequest(`/v1/friends/${friendshipId}`, { method: 'DELETE' });
}
