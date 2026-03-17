export interface User {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  bio?: string | null;
  isAdmin?: boolean;
  [key: string]: unknown;
}

export type NotificationPreference = 'ALL' | 'MENTIONS' | 'MUTE';

export interface ChannelMember {
  userId: string;
  role?: string;
  isStarred?: boolean;
  lastReadAt?: string;
  notificationPreference?: NotificationPreference;
  user?: User;
  [key: string]: unknown;
}

export interface Attachment {
  id?: string;
  url: string;
  filename: string;
  mimetype: string;
  size: number;
  uploadId?: string;
  [key: string]: unknown;
}

export interface Channel {
  id: string;
  name: string;
  description?: string | null;
  isPrivate?: boolean;
  isArchived?: boolean;
  unreadCount?: number;
  isStarred?: boolean;
  notificationPreference?: NotificationPreference;
  members?: ChannelMember[];
  [key: string]: unknown;
}

export interface Message {
  id: string;
  content: string;
  senderId?: string;
  threadId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  isPinned?: boolean;
  reactions?: unknown[];
  mentions?: unknown[];
  attachments?: Attachment[];
  replyCount?: number;
  [key: string]: unknown;
}

export interface DMSession {
  id: string;
  participants?: DMSessionParticipant[];
  isArchived?: boolean;
  unreadCount?: number;
  isStarred?: boolean;
  notificationPreference?: NotificationPreference;
  [key: string]: unknown;
}

export interface DMSessionParticipant {
  userId: string;
  notificationPreference?: NotificationPreference;
  user?: User;
  [key: string]: unknown;
}

export interface DMMessage {
  id: string;
  content: string;
  senderId?: string;
  threadId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  isPinned?: boolean;
  readBy?: string[];
  reactions?: unknown[];
  mentions?: unknown[];
  attachments?: Attachment[];
  replyCount?: number;
  [key: string]: unknown;
}

export interface CustomEmoji {
  id: string;
  name: string;
  imageUrl: string;
  [key: string]: unknown;
}

export interface Bookmark {
  id: string;
  createdAt?: string;
  message?: Message & { channel?: Channel; sender?: User };
  dmMessage?: DMMessage & { session?: DMSession; sender?: User };
  [key: string]: unknown;
}

export interface Thread {
  id: string;
  type: 'channel' | 'dm';
  content: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface SearchMessageResult {
  id: string;
  content: string;
  createdAt: string;
  threadId?: string | null;
  type: 'channel' | 'dm';
  channel?: Channel;
  session?: DMSession;
  sender?: User;
  [key: string]: unknown;
}

export interface SearchResults {
  query: string;
  channels: Channel[];
  users: User[];
  messages: SearchMessageResult[];
}

export interface Organization {
  id: string;
  name: string;
  description?: string | null;
  role?: 'ADMIN' | 'MEMBER';
  joinedAt?: string;
  [key: string]: unknown;
}

export interface RegistrationLink {
  id: string;
  registrationUrl: string;
  isUsed: boolean;
  usageLimit?: number | null;
  usageCount?: number | null;
  createdAt?: string;
  expiresAt?: string | null;
  [key: string]: unknown;
}

export interface StorageInfo {
  storageBackend: string;
  maxUploadSizeBytes: number;
  orgQuotaBytes: number;
  userQuotaBytes: number;
  orgUsedBytes: number;
  userUsedBytes: number;
}

// Work Unit Types
export type WorkUnitStatus = 'DRAFT' | 'OPEN' | 'IN_PROGRESS' | 'REVIEW' | 'COMPLETED' | 'CANCELLED';

export interface BotUser {
  id: string;
  userId: string;
  name: string;
  description?: string | null;
  avatarUrl?: string | null;
  isActive: boolean;
  user?: {
    id: string;
    name?: string | null;
    image?: string | null;
  };
  app?: {
    id: string;
    name: string;
    iconUrl?: string | null;
    description?: string | null;
  };
  [key: string]: unknown;
}

export interface WorkUnitAgent {
  id: string;
  workUnitId: string;
  botUserId: string;
  assignedAt: string;
  botUser: BotUser;
  [key: string]: unknown;
}

export interface WorkUnitReviewer {
  id: string;
  workUnitId: string;
  userId: string;
  addedAt: string;
  user: {
    id: string;
    name?: string | null;
    email: string;
    image?: string | null;
  };
  [key: string]: unknown;
}

export interface WorkUnitOutput {
  id: string;
  workUnitId: string;
  botUserId?: string | null;
  userId?: string | null;
  type: string;
  name: string;
  content: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  botUser?: BotUser | null;
  user?: User | null;
  [key: string]: unknown;
}

export interface WorkUnitMessage {
  id: string;
  workUnitId: string;
  senderId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  isEdited: boolean;
  sender: {
    id: string;
    name?: string | null;
    email: string;
    image?: string | null;
  };
  [key: string]: unknown;
}

export interface WorkUnit {
  id: string;
  organizationId: string;
  title: string;
  goal: string;
  context?: string | null;
  status: WorkUnitStatus;
  sourceMessageId?: string | null;
  sourceDMMessageId?: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  owner: {
    id: string;
    name?: string | null;
    email: string;
    image?: string | null;
  };
  sourceMessage?: Message & { channel?: Channel } | null;
  sourceDMMessage?: DMMessage | null;
  assignedAgents?: WorkUnitAgent[];
  reviewers?: WorkUnitReviewer[];
  outputs?: WorkUnitOutput[];
  _count?: {
    messages: number;
    outputs: number;
  };
  [key: string]: unknown;
}

export interface CreateWorkUnitInput {
  title: string;
  goal: string;
  context?: string;
  sourceMessageId?: string;
  sourceDMMessageId?: string;
}

export interface UpdateWorkUnitInput {
  title?: string;
  goal?: string;
  context?: string | null;
}
