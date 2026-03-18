export type CapsuleType = 'letter' | 'goals' | 'memories' | 'predictions';
export type CapsuleStatus = 'draft' | 'sealed' | 'opened';
export type SyncStatus = 'local' | 'pending' | 'synced' | 'error';

export type CapsuleItemCounts = {
  letter: number;
  goals: number;
  predictions: number;
  photos: number;
};

export type CapsulePhoto = {
  id: string;
  uri: string;
  width?: number;
  height?: number;
  requiresAuth?: boolean;
};

export type GoalItem = {
  id: string;
  text: string;
  completed: boolean;
};

export type UserProfile = {
  id: string;
  displayName: string;
  username: string;
};

export type CapsuleContribution = {
  id: string;
  body: string;
  contributor?: UserProfile;
};

export type AuthUser = {
  id: string;
  email: string | null;
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  tokenType: string;
  user: AuthUser;
};

export type Capsule = {
  id: string;
  title: string;
  subtitle: string;
  type: CapsuleType;
  recipient: string;
  letter: string;
  goals: GoalItem[];
  predictions: string[];
  photos: CapsulePhoto[];
  createdAt: string;
  unlockAt: string;
  openedAt?: string;
  status: CapsuleStatus;
  accent: string;
  emoji: string;
  reminderEnabled: boolean;
  reminderId?: string;
  integrityHash?: string;
  remoteId?: string;
  syncStatus?: SyncStatus;
  syncError?: string;
  contentLoaded?: boolean;
  itemCounts?: CapsuleItemCounts;
  sharedWithUsernames?: string[];
  isShared?: boolean;
  ownerId?: string;
  isOwner?: boolean;
  collaborative?: boolean;
  contributions?: CapsuleContribution[];
};

export type NewCapsule = Omit<
  Capsule,
  | 'id'
  | 'createdAt'
  | 'status'
  | 'openedAt'
  | 'reminderId'
  | 'integrityHash'
  | 'remoteId'
  | 'syncStatus'
  | 'syncError'
  | 'contentLoaded'
  | 'itemCounts'
>;

export type CountdownParts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isUnlocked: boolean;
  totalMs: number;
};

export type AppScreen = 'home' | 'vault' | 'create' | 'insights' | 'profile';
