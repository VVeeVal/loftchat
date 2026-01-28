import { FastifyInstance } from 'fastify';
import { Client } from 'pg';
import { auth } from './auth.js';
import { convertFastifyHeaders } from './utils.js';
import { config } from './config/index.js';
import { prisma } from './db.js';

interface Subscription {
    socket: any;
    channelId?: string;
    sessionId?: string;
    userId?: string;
    organizationId?: string;
    connectedAt: number;
    lastPongAt: number;
    isAlive: boolean;
    notifications?: boolean; // Subscribe to all messages for notifications
}

const subscribers = new Set<Subscription>();

// Heartbeat configuration
const HEARTBEAT_INTERVAL_MS = 30 * 1000; // Send ping every 30 seconds
const CONNECTION_TIMEOUT_MS = 90 * 1000; // Consider dead if no pong in 90 seconds

// Subscription metrics for monitoring
let totalConnectionsEver = 0;
let cleanedUpConnections = 0;
let heartbeatIntervalId: NodeJS.Timeout | null = null;

export function getSubscriptionMetrics() {
    return {
        activeConnections: subscribers.size,
        totalConnectionsEver,
        cleanedUpConnections,
        presenceOrgs: presenceByOrg.size,
    };
}

function cleanupDeadConnections() {
    const now = Date.now();
    const deadSubs: Subscription[] = [];

    for (const sub of subscribers) {
        // Check if socket is not open or hasn't responded to ping
        if (sub.socket.readyState !== sub.socket.OPEN) {
            deadSubs.push(sub);
            continue;
        }

        // Check if connection has timed out (no pong received)
        if (!sub.isAlive && now - sub.lastPongAt > CONNECTION_TIMEOUT_MS) {
            deadSubs.push(sub);
            continue;
        }
    }

    // Clean up dead subscriptions
    for (const sub of deadSubs) {
        subscribers.delete(sub);
        cleanedUpConnections++;

        // Update presence for dead connections
        if (sub.organizationId && sub.userId) {
            const statusChanged = updatePresence(sub.organizationId, sub.userId, -1);
            if (statusChanged) {
                broadcastPresenceChange(sub.organizationId);
            }
        }

        // Force close socket if still open
        try {
            if (sub.socket.readyState === sub.socket.OPEN) {
                sub.socket.close();
            }
        } catch {
            // Ignore close errors
        }
    }

    if (deadSubs.length > 0) {
        console.log(`Realtime: Cleaned up ${deadSubs.length} dead connections`);
    }
}

function sendHeartbeats() {
    for (const sub of subscribers) {
        if (sub.socket.readyState === sub.socket.OPEN) {
            // Mark as not alive until we get a pong back
            sub.isAlive = false;
            try {
                sub.socket.send(JSON.stringify({ type: 'PING', timestamp: Date.now() }));
            } catch {
                // Will be cleaned up in next cleanup cycle
            }
        }
    }
}

function startHeartbeatInterval() {
    if (heartbeatIntervalId) return;

    heartbeatIntervalId = setInterval(() => {
        // First clean up any dead connections
        cleanupDeadConnections();
        // Then send heartbeats to remaining connections
        sendHeartbeats();
    }, HEARTBEAT_INTERVAL_MS);

    console.log('Realtime: Heartbeat interval started');
}

function stopHeartbeatInterval() {
    if (heartbeatIntervalId) {
        clearInterval(heartbeatIntervalId);
        heartbeatIntervalId = null;
        console.log('Realtime: Heartbeat interval stopped');
    }
}

// User presence tracking
export type PresenceStatus = 'online' | 'away' | 'offline';

interface UserPresence {
    status: PresenceStatus;
    lastActivity: number;
    connectionCount: number;
}

// Map: organizationId -> userId -> UserPresence
const presenceByOrg = new Map<string, Map<string, UserPresence>>();

// Activity timeout for "away" status (5 minutes)
const AWAY_TIMEOUT_MS = 5 * 60 * 1000;

export function getPresenceForOrganization(organizationId: string): Record<string, PresenceStatus> {
    const orgPresence = presenceByOrg.get(organizationId);
    if (!orgPresence) return {};

    const result: Record<string, PresenceStatus> = {};
    const now = Date.now();

    for (const [userId, presence] of orgPresence.entries()) {
        if (presence.connectionCount > 0) {
            // Check if user is away (no activity in 5 minutes)
            if (now - presence.lastActivity > AWAY_TIMEOUT_MS) {
                result[userId] = 'away';
            } else {
                result[userId] = 'online';
            }
        }
    }

    return result;
}

function updatePresence(organizationId: string, userId: string, delta: number) {
    let orgPresence = presenceByOrg.get(organizationId);
    if (!orgPresence) {
        orgPresence = new Map();
        presenceByOrg.set(organizationId, orgPresence);
    }

    let presence = orgPresence.get(userId);
    if (!presence) {
        presence = { status: 'offline', lastActivity: Date.now(), connectionCount: 0 };
        orgPresence.set(userId, presence);
    }

    const previousCount = presence.connectionCount;
    presence.connectionCount = Math.max(0, presence.connectionCount + delta);
    presence.lastActivity = Date.now();

    const wasOnline = previousCount > 0;
    const isOnline = presence.connectionCount > 0;

    // Return true if presence status changed (went online or offline)
    return wasOnline !== isOnline;
}

function updateActivity(organizationId: string, userId: string) {
    const orgPresence = presenceByOrg.get(organizationId);
    if (orgPresence) {
        const presence = orgPresence.get(userId);
        if (presence) {
            const wasAway = Date.now() - presence.lastActivity > AWAY_TIMEOUT_MS;
            presence.lastActivity = Date.now();
            return wasAway; // Return true if status changed from away to online
        }
    }
    return false;
}

function broadcastPresenceChange(organizationId: string) {
    const presence = getPresenceForOrganization(organizationId);
    const event = {
        type: 'PRESENCE',
        organizationId,
        presence
    };

    for (const sub of subscribers) {
        if (sub.socket.readyState !== sub.socket.OPEN) {
            subscribers.delete(sub);
            continue;
        }

        if (sub.organizationId === organizationId) {
            sub.socket.send(JSON.stringify(event));
        }
    }
}

export default async function realtimeRoutes(app: FastifyInstance) {
    // Setup Postgres Listener
    const pgClient = new Client({
        connectionString: config.databaseUrl,
    });

    await pgClient.connect();
    await pgClient.query('LISTEN channel_events');
    await pgClient.query('LISTEN dm_events');

    console.log('Realtime: Listening for Postgres events...');

    pgClient.on('notification', (msg) => {
        if (!msg.payload) return;
        try {
            const payload = JSON.parse(msg.payload);
            const { channelId, sessionId, organizationId: eventOrgId } = payload;

            // Broadcast to matching subscribers
            for (const sub of subscribers) {
                if (sub.socket.readyState !== sub.socket.OPEN) {
                    subscribers.delete(sub);
                    continue;
                }

                // Direct channel/session match
                if (channelId && sub.channelId === channelId) {
                    sub.socket.send(JSON.stringify(payload));
                } else if (sessionId && sub.sessionId === sessionId) {
                    sub.socket.send(JSON.stringify(payload));
                }
                // Notification subscribers get INSERT events scoped to org + access
                else if (sub.notifications && sub.organizationId && payload.type === 'INSERT') {
                    if (eventOrgId && eventOrgId !== sub.organizationId) {
                        console.log('[Realtime] Notification skipped - org mismatch:', { eventOrgId, subOrgId: sub.organizationId });
                        continue;
                    }

                    if (channelId) {
                        const isPrivate = payload.channelIsPrivate === true;
                        if (isPrivate) {
                            const memberIds: string[] = payload.channelMemberIds || [];
                            if (!sub.userId || !memberIds.includes(sub.userId)) {
                                console.log('[Realtime] Notification skipped - not a member of private channel');
                                continue;
                            }
                        }
                        console.log('[Realtime] Sending channel notification to user:', sub.userId);
                        sub.socket.send(JSON.stringify(payload));
                        continue;
                    }

                    if (sessionId) {
                        const participantIds: string[] = payload.participantIds || [];
                        if (!sub.userId || !participantIds.includes(sub.userId)) {
                            console.log('[Realtime] Notification skipped - not a DM participant');
                            continue;
                        }
                        console.log('[Realtime] Sending DM notification to user:', sub.userId);
                        sub.socket.send(JSON.stringify(payload));
                        continue;
                    }
                }
            }
        } catch (e) {
            console.error('Error parsing notification payload', e);
        }
    });

    // Start heartbeat interval
    startHeartbeatInterval();

    // Clean up on close (not perfect for generic plugin but ok for app root)
    app.addHook('onClose', async () => {
        stopHeartbeatInterval();
        await pgClient.end();
    });

    // WebSocket Endpoint
    app.get('/ws', { websocket: true }, async (socket, req) => {
        const query = req.query as any;
        const channelId = query.channelId;
        const sessionId = query.sessionId;
        const notifications = query.notifications === 'true';

        // Authenticate session from cookie/headers before wiring socket
        let sessionData;
        try {
            sessionData = await auth.api.getSession({
                headers: convertFastifyHeaders(req.headers)
            });
        } catch (error) {
            socket.close();
            return;
        }

        if (!sessionData) {
            socket.close();
            return;
        }

        const dbSession = await prisma.session.findUnique({
            where: { id: sessionData.session.id },
            include: {
                user: {
                    include: {
                        organizationMemberships: {
                            orderBy: { joinedAt: 'asc' },
                            select: { organizationId: true }
                        }
                    }
                }
            }
        });
        if (!dbSession) {
            socket.close();
            return;
        }

        const orgMembership = dbSession.user.organizationMemberships[0];
        const organizationId = dbSession.activeOrganizationId || orgMembership?.organizationId;
        if (!organizationId) {
            socket.close();
            return;
        }

        const userId = sessionData.user.id;
        if (channelId) {
            const membership = await prisma.channelMember.findFirst({
                where: {
                    channelId,
                    userId,
                    channel: { organizationId }
                }
            });
            if (!membership) {
                socket.close();
                return;
            }
        }
        if (sessionId) {
            const participant = await prisma.dMParticipant.findFirst({
                where: { sessionId, userId }
            });
            if (!participant) {
                socket.close();
                return;
            }
        }

        const now = Date.now();
        const subscription: Subscription = {
            socket,
            channelId,
            sessionId,
            userId,
            organizationId,
            connectedAt: now,
            lastPongAt: now,
            isAlive: true,
            notifications,
        };
        subscribers.add(subscription);
        totalConnectionsEver++;

        // Update presence when user connects
        if (organizationId && userId) {
            const statusChanged = updatePresence(organizationId, userId, 1);
            if (statusChanged) {
                broadcastPresenceChange(organizationId);
            }
        }

        // Log connection details for debugging
        if (notifications) {
            console.log('[Realtime] Notification subscriber connected:', { userId, organizationId });
        }

        // Send connection confirmation
        socket.send(JSON.stringify({
            type: 'CONNECTED',
            notifications: notifications || false,
            channelId: channelId || null,
            sessionId: sessionId || null
        }));

        socket.on('message', (message: any) => {
            try {
                const payload = JSON.parse(message.toString());

                // Handle PONG responses for heartbeat
                if (payload?.type === 'PONG') {
                    subscription.isAlive = true;
                    subscription.lastPongAt = Date.now();
                    return;
                }

                // Handle activity updates (keeps user "online" instead of "away")
                if (payload?.type === 'ACTIVITY') {
                    if (subscription.organizationId && subscription.userId) {
                        const statusChanged = updateActivity(subscription.organizationId, subscription.userId);
                        if (statusChanged) {
                            broadcastPresenceChange(subscription.organizationId);
                        }
                    }
                    return;
                }

                if (payload?.type !== 'TYPING') return;

                // Update activity on typing
                if (subscription.organizationId && subscription.userId) {
                    const statusChanged = updateActivity(subscription.organizationId, subscription.userId);
                    if (statusChanged) {
                        broadcastPresenceChange(subscription.organizationId);
                    }
                }

                if (subscription.channelId && payload.channelId !== subscription.channelId) return;
                if (subscription.sessionId && payload.sessionId !== subscription.sessionId) return;

                const msgUserId = typeof payload.user?.id === 'string' ? payload.user.id : '';
                if (!msgUserId) return;
                const userName = typeof payload.user?.name === 'string' && payload.user.name.trim().length > 0
                    ? payload.user.name
                    : 'Someone';
                const threadId = typeof payload.threadId === 'string' ? payload.threadId : undefined;

                const event = {
                    type: 'TYPING',
                    channelId: subscription.channelId,
                    sessionId: subscription.sessionId,
                    threadId,
                    user: { id: msgUserId, name: userName },
                    isTyping: !!payload.isTyping,
                    timestamp: Date.now()
                };

                for (const sub of subscribers) {
                    if (sub.socket.readyState !== sub.socket.OPEN) {
                        subscribers.delete(sub);
                        continue;
                    }

                    const isChannelMatch = event.channelId && sub.channelId === event.channelId;
                    const isSessionMatch = event.sessionId && sub.sessionId === event.sessionId;

                    if ((isChannelMatch || isSessionMatch) && sub.socket !== socket) {
                        sub.socket.send(JSON.stringify(event));
                    }
                }
            } catch (e) {
                console.error('Error handling client message', e);
            }
        });

        socket.on('close', () => {
            subscribers.delete(subscription);
            // Update presence when user disconnects
            if (subscription.organizationId && subscription.userId) {
                const statusChanged = updatePresence(subscription.organizationId, subscription.userId, -1);
                if (statusChanged) {
                    broadcastPresenceChange(subscription.organizationId);
                }
            }
        });

        // Send hello
        // socket.send(JSON.stringify({ type: 'CONNECTED' }));
    });
}
