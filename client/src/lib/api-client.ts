import type {
  Attachment,
  Bookmark,
  Channel,
  CustomEmoji,
  DMMessage,
  DMSession,
  Message,
  Organization,
  SearchResults,
  StorageInfo,
  Thread,
  User
} from '@/types/api';

export class APIError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
export const API_URL = BASE_URL.endsWith('/api') ? BASE_URL : `${BASE_URL}/api`;
export const AUTH_BASE_URL = API_URL.replace(/\/api$/, '');

class APIClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

    private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        const url = `${this.baseURL}${endpoint}`;
        const headers = new Headers(options.headers);

        const hasBody = options.body !== undefined && options.body !== null;
        if (hasBody && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
            headers.set('Content-Type', 'application/json');
        }

    try {
      const res = await fetch(url, {
        ...options,
        headers,
        credentials: 'include',
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new APIError(res.status, error.error || res.statusText, error.details);
      }

      return res.json();
    } catch (err) {
      if (err instanceof APIError) throw err;
      throw new APIError(0, 'Network error');
    }
  }

  channels = {
    list: (includeArchived?: boolean) =>
      this.request<Channel[]>(`/channels${includeArchived ? '?includeArchived=true' : ''}`),
    get: (id: string, cursor?: string) =>
      this.request<{ channel: Channel; messages: Message[] }>(
        `/channels/${id}${cursor ? `?cursor=${cursor}` : ''}`
      ),
    create: (data: { name: string; description?: string; isPrivate?: boolean }) =>
      this.request<Channel>('/channels', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    join: (id: string) =>
      this.request('/channels/' + id + '/join', { method: 'POST' }),
    markRead: (id: string) =>
      this.request('/channels/' + id + '/read', { method: 'POST' }),
    star: (id: string, isStarred: boolean) =>
      this.request('/channels/' + id + '/star', {
        method: 'POST',
        body: JSON.stringify({ isStarred }),
      }),
    updateNotificationPreference: (id: string, preference: 'ALL' | 'MENTIONS' | 'MUTE') =>
      this.request('/channels/' + id + '/notifications', {
        method: 'POST',
        body: JSON.stringify({ preference }),
      }),
    archive: (id: string, isArchived: boolean) =>
      this.request('/channels/' + id + '/archive', {
        method: 'POST',
        body: JSON.stringify({ isArchived }),
      }),
    addMember: (id: string, userId: string) =>
      this.request('/channels/' + id + '/members', {
        method: 'POST',
        body: JSON.stringify({ userId }),
      }),
    sendMessage: (id: string, content: string, threadId?: string, attachments?: Attachment[]) =>
      this.request<Message>('/channels/' + id + '/messages', {
        method: 'POST',
        body: JSON.stringify({ content, threadId, attachments }),
      }),
    editMessage: (channelId: string, messageId: string, content: string) =>
      this.request<Message>(`/channels/${channelId}/messages/${messageId}`, {
        method: 'PUT',
        body: JSON.stringify({ content }),
      }),
    deleteMessage: (channelId: string, messageId: string) =>
      this.request(`/channels/${channelId}/messages/${messageId}`, {
        method: 'DELETE',
      }),
    toggleReaction: (channelId: string, messageId: string, emoji: string) =>
      this.request<{ reactions: unknown[] }>(
        `/channels/${channelId}/messages/${messageId}/reactions`,
        {
          method: 'POST',
          body: JSON.stringify({ emoji }),
        }
      ),
    togglePin: (channelId: string, messageId: string, isPinned?: boolean) =>
      this.request<Message>(`/channels/${channelId}/messages/${messageId}/pin`, {
        method: 'POST',
        body: JSON.stringify({ isPinned }),
      }),
    pinned: (channelId: string) =>
      this.request<Message[]>(`/channels/${channelId}/pinned`),
    getThread: (channelId: string, threadId: string) =>
      this.request<{ channel: Channel; messages: Message[] }>(
        `/channels/${channelId}?threadId=${threadId}`
      ),
  };

  dms = {
    list: (includeArchived?: boolean) =>
      this.request<DMSession[]>(`/dms${includeArchived ? '?includeArchived=true' : ''}`),
    get: (id: string, cursor?: string) =>
      this.request<{ session: DMSession; messages: DMMessage[] }>(
        `/dms/${id}${cursor ? `?cursor=${cursor}` : ''}`
      ),
    create: (targetUserId: string) =>
      this.request<DMSession>('/dms', {
        method: 'POST',
        body: JSON.stringify({ targetUserId }),
      }),
    markRead: (id: string) =>
      this.request('/dms/' + id + '/read', { method: 'POST' }),
    star: (id: string, isStarred: boolean) =>
      this.request('/dms/' + id + '/star', {
        method: 'POST',
        body: JSON.stringify({ isStarred }),
      }),
    updateNotificationPreference: (id: string, preference: 'ALL' | 'MENTIONS' | 'MUTE') =>
      this.request('/dms/' + id + '/notifications', {
        method: 'POST',
        body: JSON.stringify({ preference }),
      }),
    archive: (id: string, isArchived: boolean) =>
      this.request('/dms/' + id + '/archive', {
        method: 'POST',
        body: JSON.stringify({ isArchived }),
      }),
    sendMessage: (id: string, content: string, threadId?: string, attachments?: Attachment[]) =>
      this.request<DMMessage>('/dms/' + id + '/messages', {
        method: 'POST',
        body: JSON.stringify({ content, threadId, attachments }),
      }),
    editMessage: (sessionId: string, messageId: string, content: string) =>
      this.request<DMMessage>(`/dms/${sessionId}/messages/${messageId}`, {
        method: 'PUT',
        body: JSON.stringify({ content }),
      }),
    deleteMessage: (sessionId: string, messageId: string) =>
      this.request(`/dms/${sessionId}/messages/${messageId}`, {
        method: 'DELETE',
      }),
    toggleReaction: (sessionId: string, messageId: string, emoji: string) =>
      this.request<{ reactions: unknown[] }>(
        `/dms/${sessionId}/messages/${messageId}/reactions`,
        {
          method: 'POST',
          body: JSON.stringify({ emoji }),
        }
      ),
    togglePin: (sessionId: string, messageId: string, isPinned?: boolean) =>
      this.request<DMMessage>(`/dms/${sessionId}/messages/${messageId}/pin`, {
        method: 'POST',
        body: JSON.stringify({ isPinned }),
      }),
    pinned: (sessionId: string) =>
      this.request<DMMessage[]>(`/dms/${sessionId}/pinned`),
    getThread: (sessionId: string, threadId: string) =>
      this.request<{ session: DMSession; messages: DMMessage[] }>(
        `/dms/${sessionId}?threadId=${threadId}`
      ),
  };

  storage = {
    info: () => this.request<StorageInfo>('/storage/info')
  };

  threads = {
    list: () => this.request<Thread[]>('/threads'),
  };

  search = (query: string, type?: 'all' | 'channels' | 'users' | 'messages', limit?: number) => {
    const params = new URLSearchParams();
    params.set('q', query);
    if (type && type !== 'all') params.set('type', type);
    if (limit) params.set('limit', String(limit));
    return this.request<SearchResults>(`/search?${params.toString()}`);
  };

  users = {
    list: () => this.request<User[]>('/users'),
    presence: () => this.request<Record<string, 'online' | 'away' | 'offline'>>('/users/presence'),
    me: () => this.request<User>('/users/me'),
    update: (data: { name?: string; bio?: string }) =>
      this.request<User>('/users/me', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    uploadAvatar: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${this.baseURL}/users/me/avatar`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new APIError(res.status, error.error || 'Failed to upload avatar');
      }

      return res.json() as Promise<User>;
    },
    changePassword: (currentPassword: string, newPassword: string) =>
      this.request<{ success: boolean }>('/users/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      }),
  };

  admin = {
    listUsers: async () => {
      const data = await this.request<{ users: User[] }>('/users/admin/list');
      return data.users || [];
    },
    resetPassword: (userId: string) =>
      this.request<{ newPassword: string }>('/users/admin/reset-password', {
        method: 'POST',
        body: JSON.stringify({ userId }),
      }),
  };

  organizations = {
    list: () => this.request<{ organizations: Organization[] }>('/organizations'),
    current: () => this.request<Organization>('/organizations/current'),
    switch: (organizationId: string) =>
      this.request('/organizations/switch', {
        method: 'POST',
        body: JSON.stringify({ organizationId }),
      }),
    create: (name: string, description?: string) =>
      this.request<Organization>('/organizations', {
        method: 'POST',
        body: JSON.stringify({ name, description }),
      }),
  };

  emoji = {
    list: () => this.request<CustomEmoji[]>('/emoji'),
    create: (data: { name: string; imageUrl: string }) =>
      this.request<CustomEmoji>('/emoji', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: { name?: string; imageUrl?: string }) =>
      this.request<CustomEmoji>(`/emoji/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      this.request(`/emoji/${id}`, {
        method: 'DELETE',
      }),
  };

  bookmarks = {
    list: () => this.request<Bookmark[]>('/bookmarks'),
    toggle: (data: { messageId?: string; dmMessageId?: string }) =>
      this.request<{ bookmarked: boolean; bookmark?: Bookmark }>('/bookmarks', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  };

  registrationLinks = {
    list: () => this.request('/registration-links'),
    create: (data: { expiresInHours?: number; usageLimit?: number; allowUnlimited?: boolean } = {}) =>
      this.request('/registration-links', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  };

  upload = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${this.baseURL}/upload`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });

    if (!res.ok) {
      throw new APIError(res.status, 'Failed to upload file');
    }

    const payload = await res.json();
    return { ...payload, uploadId: payload.uploadId ?? payload.id } as Attachment;
  };

}

export const api = new APIClient(API_URL);
