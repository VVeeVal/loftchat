import { formatMessage, formatDMMessage, formatChannel, formatUser, toSlackTimestamp } from './slack-formatter.js';

/**
 * Slack event types that can be subscribed to
 */
export enum SlackEventType {
  // Message events
  MESSAGE_CHANNELS = 'message.channels',
  MESSAGE_IM = 'message.im',
  MESSAGE_CHANGED = 'message.changed',
  MESSAGE_DELETED = 'message.deleted',

  // Reaction events
  REACTION_ADDED = 'reaction_added',
  REACTION_REMOVED = 'reaction_removed',

  // Channel events
  CHANNEL_CREATED = 'channel_created',
  CHANNEL_DELETED = 'channel_deleted',
  CHANNEL_ARCHIVE = 'channel_archive',
  CHANNEL_UNARCHIVE = 'channel_unarchive',
  CHANNEL_RENAME = 'channel_rename',

  // Member events
  MEMBER_JOINED_CHANNEL = 'member_joined_channel',
  MEMBER_LEFT_CHANNEL = 'member_left_channel',

  // User events
  USER_CHANGE = 'user_change',

  // Presence events
  PRESENCE_CHANGE = 'presence_change'
}

/**
 * Base event wrapper structure for Slack events
 */
interface SlackEventWrapper {
  token?: string;
  team_id: string;
  api_app_id: string;
  event: any;
  type: 'event_callback';
  event_id: string;
  event_time: number;
}

/**
 * Creates a message.channels event from a loft channel message
 */
export function createMessageChannelsEvent(
  message: any,
  organizationId: string,
  appId: string
): SlackEventWrapper {
  return {
    team_id: organizationId,
    api_app_id: appId,
    event: {
      type: 'message',
      subtype: undefined,
      channel: message.channelId,
      user: message.senderId,
      text: message.content,
      ts: toSlackTimestamp(message.createdAt),
      event_ts: toSlackTimestamp(message.createdAt),
      channel_type: message.channel?.isPrivate ? 'group' : 'channel',
      thread_ts: message.threadId ? toSlackTimestamp(message.parent?.createdAt) : undefined
    },
    type: 'event_callback',
    event_id: `Ev${message.id}`,
    event_time: Math.floor(message.createdAt.getTime() / 1000)
  };
}

/**
 * Creates a message.im event from a loft DM message
 */
export function createMessageIMEvent(
  message: any,
  organizationId: string,
  appId: string
): SlackEventWrapper {
  return {
    team_id: organizationId,
    api_app_id: appId,
    event: {
      type: 'message',
      channel: message.sessionId,
      user: message.senderId,
      text: message.content,
      ts: toSlackTimestamp(message.createdAt),
      event_ts: toSlackTimestamp(message.createdAt),
      channel_type: 'im'
    },
    type: 'event_callback',
    event_id: `Ev${message.id}`,
    event_time: Math.floor(message.createdAt.getTime() / 1000)
  };
}

/**
 * Creates a message.changed event (message edited)
 */
export function createMessageChangedEvent(
  message: any,
  organizationId: string,
  appId: string,
  channelType: 'channel' | 'im' = 'channel'
): SlackEventWrapper {
  return {
    team_id: organizationId,
    api_app_id: appId,
    event: {
      type: 'message',
      subtype: 'message_changed',
      channel: channelType === 'channel' ? message.channelId : message.sessionId,
      message: {
        type: 'message',
        user: message.senderId,
        text: message.content,
        ts: toSlackTimestamp(message.createdAt),
        edited: {
          user: message.senderId,
          ts: toSlackTimestamp(message.updatedAt)
        }
      },
      previous_message: {
        type: 'message',
        user: message.senderId,
        text: message.previousContent || message.content,
        ts: toSlackTimestamp(message.createdAt)
      },
      event_ts: toSlackTimestamp(message.updatedAt),
      channel_type: channelType
    },
    type: 'event_callback',
    event_id: `Ev${message.id}-edit`,
    event_time: Math.floor(message.updatedAt.getTime() / 1000)
  };
}

/**
 * Creates a message.deleted event
 */
export function createMessageDeletedEvent(
  message: any,
  organizationId: string,
  appId: string,
  channelType: 'channel' | 'im' = 'channel'
): SlackEventWrapper {
  return {
    team_id: organizationId,
    api_app_id: appId,
    event: {
      type: 'message',
      subtype: 'message_deleted',
      channel: channelType === 'channel' ? message.channelId : message.sessionId,
      deleted_ts: toSlackTimestamp(message.createdAt),
      event_ts: toSlackTimestamp(new Date()),
      channel_type: channelType
    },
    type: 'event_callback',
    event_id: `Ev${message.id}-delete`,
    event_time: Math.floor(Date.now() / 1000)
  };
}

/**
 * Creates a reaction_added event
 */
export function createReactionAddedEvent(
  reaction: any,
  message: any,
  organizationId: string,
  appId: string,
  itemType: 'message' | 'dm_message' = 'message'
): SlackEventWrapper {
  return {
    team_id: organizationId,
    api_app_id: appId,
    event: {
      type: 'reaction_added',
      user: reaction.userId,
      reaction: reaction.emoji,
      item_user: message.senderId,
      item: {
        type: 'message',
        channel: itemType === 'message' ? message.channelId : message.sessionId,
        ts: toSlackTimestamp(message.createdAt)
      },
      event_ts: toSlackTimestamp(reaction.createdAt)
    },
    type: 'event_callback',
    event_id: `Ev${reaction.id}`,
    event_time: Math.floor(reaction.createdAt.getTime() / 1000)
  };
}

/**
 * Creates a reaction_removed event
 */
export function createReactionRemovedEvent(
  reaction: any,
  message: any,
  organizationId: string,
  appId: string,
  itemType: 'message' | 'dm_message' = 'message'
): SlackEventWrapper {
  return {
    team_id: organizationId,
    api_app_id: appId,
    event: {
      type: 'reaction_removed',
      user: reaction.userId,
      reaction: reaction.emoji,
      item_user: message.senderId,
      item: {
        type: 'message',
        channel: itemType === 'message' ? message.channelId : message.sessionId,
        ts: toSlackTimestamp(message.createdAt)
      },
      event_ts: toSlackTimestamp(new Date())
    },
    type: 'event_callback',
    event_id: `Ev${reaction.id}-remove`,
    event_time: Math.floor(Date.now() / 1000)
  };
}

/**
 * Creates a channel_created event
 */
export function createChannelCreatedEvent(
  channel: any,
  organizationId: string,
  appId: string
): SlackEventWrapper {
  return {
    team_id: organizationId,
    api_app_id: appId,
    event: {
      type: 'channel_created',
      channel: {
        id: channel.id,
        name: channel.name,
        created: Math.floor(channel.createdAt.getTime() / 1000),
        creator: channel.createdBy
      },
      event_ts: toSlackTimestamp(channel.createdAt)
    },
    type: 'event_callback',
    event_id: `Ev${channel.id}`,
    event_time: Math.floor(channel.createdAt.getTime() / 1000)
  };
}

/**
 * Creates a channel_archive event
 */
export function createChannelArchiveEvent(
  channel: any,
  userId: string,
  organizationId: string,
  appId: string
): SlackEventWrapper {
  return {
    team_id: organizationId,
    api_app_id: appId,
    event: {
      type: 'channel_archive',
      channel: channel.id,
      user: userId,
      event_ts: toSlackTimestamp(new Date())
    },
    type: 'event_callback',
    event_id: `Ev${channel.id}-archive`,
    event_time: Math.floor(Date.now() / 1000)
  };
}

/**
 * Creates a channel_unarchive event
 */
export function createChannelUnarchiveEvent(
  channel: any,
  userId: string,
  organizationId: string,
  appId: string
): SlackEventWrapper {
  return {
    team_id: organizationId,
    api_app_id: appId,
    event: {
      type: 'channel_unarchive',
      channel: channel.id,
      user: userId,
      event_ts: toSlackTimestamp(new Date())
    },
    type: 'event_callback',
    event_id: `Ev${channel.id}-unarchive`,
    event_time: Math.floor(Date.now() / 1000)
  };
}

/**
 * Creates a member_joined_channel event
 */
export function createMemberJoinedChannelEvent(
  channelId: string,
  userId: string,
  organizationId: string,
  appId: string
): SlackEventWrapper {
  return {
    team_id: organizationId,
    api_app_id: appId,
    event: {
      type: 'member_joined_channel',
      user: userId,
      channel: channelId,
      channel_type: 'channel',
      team: organizationId,
      event_ts: toSlackTimestamp(new Date())
    },
    type: 'event_callback',
    event_id: `Ev${channelId}-${userId}-join`,
    event_time: Math.floor(Date.now() / 1000)
  };
}

/**
 * Creates a member_left_channel event
 */
export function createMemberLeftChannelEvent(
  channelId: string,
  userId: string,
  organizationId: string,
  appId: string
): SlackEventWrapper {
  return {
    team_id: organizationId,
    api_app_id: appId,
    event: {
      type: 'member_left_channel',
      user: userId,
      channel: channelId,
      channel_type: 'channel',
      team: organizationId,
      event_ts: toSlackTimestamp(new Date())
    },
    type: 'event_callback',
    event_id: `Ev${channelId}-${userId}-leave`,
    event_time: Math.floor(Date.now() / 1000)
  };
}

/**
 * Creates a user_change event
 */
export function createUserChangeEvent(
  user: any,
  organizationId: string,
  appId: string
): SlackEventWrapper {
  return {
    team_id: organizationId,
    api_app_id: appId,
    event: {
      type: 'user_change',
      user: formatUser(user),
      event_ts: toSlackTimestamp(user.updatedAt || new Date())
    },
    type: 'event_callback',
    event_id: `Ev${user.id}-change`,
    event_time: Math.floor((user.updatedAt || new Date()).getTime() / 1000)
  };
}
