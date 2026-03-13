/**
 * Utilities to format loft data models into Slack-compatible API formats
 */

/**
 * Converts a loft message to Slack message format
 */
export function formatMessage(message: any) {
  return {
    type: 'message',
    user: message.senderId,
    text: message.content,
    ts: toSlackTimestamp(message.createdAt),
    channel: message.channelId,
    thread_ts: message.threadId ? toSlackTimestamp(message.parent?.createdAt) : undefined,
    edited: message.isEdited
      ? {
          user: message.senderId,
          ts: toSlackTimestamp(message.updatedAt)
        }
      : undefined,
    attachments: message.attachments?.map(formatAttachment) || [],
    reactions: message.reactions ? formatReactions(message.reactions) : undefined,
    is_starred: message.bookmarks?.length > 0,
    pinned_to: message.isPinned ? [message.channelId] : undefined,
    reply_count: message.replyCount || 0
  };
}

/**
 * Converts a loft DM message to Slack message format
 */
export function formatDMMessage(message: any) {
  return {
    type: 'message',
    user: message.senderId,
    text: message.content,
    ts: toSlackTimestamp(message.createdAt),
    channel: message.sessionId,
    thread_ts: message.threadId ? toSlackTimestamp(message.parent?.createdAt) : undefined,
    edited: message.isEdited
      ? {
          user: message.senderId,
          ts: toSlackTimestamp(message.updatedAt)
        }
      : undefined,
    attachments: message.attachments?.map(formatAttachment) || [],
    reactions: message.reactions ? formatReactions(message.reactions) : undefined,
    reply_count: message.replyCount || 0
  };
}

/**
 * Converts a loft channel to Slack channel format
 */
export function formatChannel(channel: any) {
  return {
    id: channel.id,
    name: channel.name,
    is_channel: true,
    is_group: false,
    is_im: false,
    is_mpim: false,
    is_private: channel.isPrivate,
    created: toSlackTimestamp(channel.createdAt),
    is_archived: channel.isArchived,
    is_general: channel.name === 'general',
    unlinked: 0,
    creator: channel.createdBy,
    name_normalized: channel.name.toLowerCase(),
    is_shared: false,
    is_ext_shared: false,
    is_org_shared: false,
    is_pending_ext_shared: false,
    is_member: channel.members ? channel.members.some((m: any) => m.userId) : false,
    topic: {
      value: channel.description || '',
      creator: channel.createdBy,
      last_set: toSlackTimestamp(channel.createdAt)
    },
    purpose: {
      value: channel.description || '',
      creator: channel.createdBy,
      last_set: toSlackTimestamp(channel.createdAt)
    },
    num_members: channel.members?.length || 0
  };
}

/**
 * Converts a loft DM session to Slack IM/DM format
 */
export function formatDMSession(session: any, currentUserId: string) {
  // Find the other participant
  const otherParticipant = session.participants?.find(
    (p: any) => p.userId !== currentUserId
  );

  return {
    id: session.id,
    created: toSlackTimestamp(session.createdAt),
    is_im: true,
    is_org_shared: false,
    user: otherParticipant?.userId || '',
    is_user_deleted: false,
    priority: 0
  };
}

/**
 * Converts a loft user to Slack user format
 */
export function formatUser(user: any) {
  return {
    id: user.id,
    team_id: user.organizationId || '',
    name: user.name || user.email,
    deleted: false,
    color: '9f69e7', // Default color
    real_name: user.name || '',
    tz: 'America/Los_Angeles',
    tz_label: 'Pacific Time',
    tz_offset: -28800,
    profile: {
      title: user.bio || '',
      phone: '',
      skype: '',
      real_name: user.name || '',
      real_name_normalized: user.name || '',
      display_name: user.name || '',
      display_name_normalized: user.name || '',
      status_text: '',
      status_emoji: '',
      status_expiration: 0,
      avatar_hash: '',
      email: user.email,
      image_24: user.image || '',
      image_32: user.image || '',
      image_48: user.image || '',
      image_72: user.image || '',
      image_192: user.image || '',
      image_512: user.image || ''
    },
    is_admin: user.isAdmin || false,
    is_owner: false,
    is_primary_owner: false,
    is_restricted: false,
    is_ultra_restricted: false,
    is_bot: !!user.botUser,
    updated: toSlackTimestamp(user.updatedAt || user.createdAt),
    is_app_user: false
  };
}

/**
 * Converts a loft attachment to Slack attachment format
 */
export function formatAttachment(attachment: any) {
  return {
    id: attachment.id,
    title: attachment.filename,
    mimetype: attachment.mimetype,
    filetype: attachment.mimetype.split('/')[1],
    url_private: attachment.url,
    url_private_download: attachment.url,
    permalink: attachment.url,
    size: attachment.size,
    timestamp: toSlackTimestamp(attachment.createdAt)
  };
}

/**
 * Formats reactions array to Slack format
 */
export function formatReactions(reactions: any[]) {
  // Group reactions by emoji
  const reactionMap = new Map<string, string[]>();

  for (const reaction of reactions) {
    const users = reactionMap.get(reaction.emoji) || [];
    users.push(reaction.userId);
    reactionMap.set(reaction.emoji, users);
  }

  // Convert to Slack format
  return Array.from(reactionMap.entries()).map(([emoji, users]) => ({
    name: emoji,
    users,
    count: users.length
  }));
}

/**
 * Converts a JavaScript Date to Slack timestamp format (seconds.microseconds)
 */
export function toSlackTimestamp(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const seconds = Math.floor(d.getTime() / 1000);
  const microseconds = (d.getMilliseconds() * 1000).toString().padStart(6, '0');
  return `${seconds}.${microseconds}`;
}

/**
 * Converts a Slack timestamp to JavaScript Date
 */
export function fromSlackTimestamp(timestamp: string): Date {
  const [seconds, microseconds] = timestamp.split('.');
  const milliseconds = parseInt(microseconds || '0') / 1000;
  return new Date(parseInt(seconds) * 1000 + milliseconds);
}

/**
 * Formats an API error response in Slack format
 */
export function formatError(error: string, details?: string) {
  return {
    ok: false,
    error,
    ...(details && { detail: details })
  };
}

/**
 * Formats a successful API response in Slack format
 */
export function formatSuccess<T>(data: T) {
  return {
    ok: true,
    ...data
  };
}

/**
 * Formats pagination metadata in Slack cursor format
 */
export interface PaginationMetadata {
  nextCursor?: string;
  hasMore: boolean;
}

export function formatPagination(
  items: any[],
  limit: number,
  cursor?: string
): PaginationMetadata {
  const hasMore = items.length > limit;

  if (hasMore) {
    items.pop(); // Remove the extra item
  }

  return {
    nextCursor: hasMore ? items[items.length - 1].id : undefined,
    hasMore
  };
}
