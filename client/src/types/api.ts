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
  participants?: unknown[];
  isArchived?: boolean;
  unreadCount?: number;
  isStarred?: boolean;
  notificationPreference?: NotificationPreference;
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

export interface StorageInfo {
  storageBackend: string;
  maxUploadSizeBytes: number;
  orgQuotaBytes: number;
  userQuotaBytes: number;
  orgUsedBytes: number;
  userUsedBytes: number;
}
