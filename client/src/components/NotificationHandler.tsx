import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authClient } from '@/lib/auth-client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useNotifications, registerNotificationHandler } from '@/hooks/useNotifications';
import { api, API_URL } from '@/lib/api-client';
import type { Channel, DMSession, NotificationPreference } from '@/types/api';

const WS_URL = API_URL.replace('http', 'ws') + '/ws';

function shouldNotify(
    preference: NotificationPreference | undefined,
    message: any,
    currentUserId: string
): boolean {
    if (!preference) return true;

    switch (preference) {
        case 'MUTE':
            return false;
        case 'MENTIONS':
            // Check if current user is mentioned in the message
            const mentions = message?.mentions || [];
            return mentions.some((mention: any) =>
                mention.userId === currentUserId || mention.user?.id === currentUserId
            );
        case 'ALL':
        default:
            return true;
    }
}

export function NotificationHandler() {
    const navigate = useNavigate();
    const location = useLocation();
    const queryClient = useQueryClient();
    const { data: sessionData } = authClient.useSession();
    const currentUserId = sessionData?.user?.id;
    const { currentOrganization } = useOrganization();
    const organizationId = currentOrganization?.id;
    const { showNotification, requestPermission, permission } = useNotifications();
    const socketRef = useRef<WebSocket | null>(null);

    // Fetch channels and DMs for notification preferences
    const { data: channels } = useQuery({
        queryKey: ['channels'],
        queryFn: () => api.channels.list(),
        enabled: !!organizationId,
    });

    const { data: dms } = useQuery({
        queryKey: ['dms'],
        queryFn: () => api.dms.list(),
        enabled: !!organizationId,
    });

    // Create preference lookup maps
    const channelPreferences = useRef<Map<string, NotificationPreference>>(new Map());
    const dmPreferences = useRef<Map<string, NotificationPreference>>(new Map());

    useEffect(() => {
        if (channels) {
            channelPreferences.current.clear();
            channels.forEach((channel: Channel) => {
                if (channel.notificationPreference) {
                    channelPreferences.current.set(channel.id, channel.notificationPreference);
                }
            });
        }
    }, [channels]);

    useEffect(() => {
        if (dms) {
            dmPreferences.current.clear();
            dms.forEach((dm: DMSession) => {
                if (dm.notificationPreference) {
                    dmPreferences.current.set(dm.id, dm.notificationPreference);
                }
            });
        }
    }, [dms]);

    // Request notification permission on first load if not already granted/denied
    useEffect(() => {
        if (permission === 'default') {
            // Delay the permission request to not be intrusive
            const timer = setTimeout(() => {
                requestPermission();
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [permission, requestPermission]);

    // Register the notification handler
    useEffect(() => {
        const unregister = registerNotificationHandler((title, body, onClick) => {
            showNotification(title, { body, onClick });
        });
        return unregister;
    }, [showNotification]);

    // Subscribe to all channels/DMs for notifications
    useEffect(() => {
        if (!organizationId || !currentUserId) return;

        const closeSocket = (socket: WebSocket) => {
            if (socket.readyState === WebSocket.CONNECTING) {
                socket.addEventListener('open', () => socket.close(), { once: true });
                return;
            }
            if (socket.readyState === WebSocket.OPEN) {
                socket.close();
            }
        };

        if (socketRef.current) {
            closeSocket(socketRef.current);
        }

        // Connect to a "global" notification channel
        const params = new URLSearchParams();
        params.append('userId', currentUserId);
        params.append('organizationId', organizationId);
        params.append('notifications', 'true');

        const ws = new WebSocket(`${WS_URL}?${params.toString()}`);
        socketRef.current = ws;

        ws.onopen = () => {
            console.log('[NotificationHandler] WebSocket connected for notifications');
        };

        ws.onerror = (error) => {
            console.error('[NotificationHandler] WebSocket error:', error);
        };

        ws.onmessage = (event) => {
            try {
                const payload = JSON.parse(event.data);

                // Handle PING from server
                if (payload.type === 'PING') {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'PONG', timestamp: payload.timestamp }));
                    }
                    return;
                }

                // Handle connection confirmation
                if (payload.type === 'CONNECTED') {
                    console.log('[NotificationHandler] Connection confirmed:', payload);
                    return;
                }

                console.log('[NotificationHandler] Received event:', payload.type, payload);

                // Handle new messages for notifications
                if (payload.type === 'INSERT') {
                    const message = payload.message;
                    const senderId = message?.senderId || message?.sender?.id;

                    console.log('[NotificationHandler] INSERT event - senderId:', senderId, 'currentUserId:', currentUserId);

                    // Don't notify for own messages
                    if (senderId === currentUserId) {
                        console.log('[NotificationHandler] Skipping own message');
                        return;
                    }

                    // Check if we're currently viewing this channel/DM
                    const currentPath = location.pathname;
                    if (payload.channelId && currentPath === `/channels/${payload.channelId}`) {
                        console.log('[NotificationHandler] Skipping - currently viewing this channel');
                        return;
                    }
                    if (payload.sessionId && currentPath === `/dms/${payload.sessionId}`) {
                        console.log('[NotificationHandler] Skipping - currently viewing this DM');
                        return;
                    }

                    // Check notification preferences
                    let preference: NotificationPreference | undefined;
                    if (payload.channelId) {
                        preference = channelPreferences.current.get(payload.channelId);
                    } else if (payload.sessionId) {
                        preference = dmPreferences.current.get(payload.sessionId);
                    }

                    // Skip notification if preferences say so
                    if (!shouldNotify(preference, message, currentUserId!)) {
                        console.log('[NotificationHandler] Skipping due to notification preference:', preference);
                        return;
                    }

                    console.log('[NotificationHandler] Will show notification');

                    const senderName = message?.sender?.name || message?.sender?.email || 'Someone';
                    const content = message?.content || 'New message';
                    const truncatedContent = content.length > 100 ? content.substring(0, 100) + '...' : content;

                    // Determine navigation target
                    let navigateTo: string | undefined;
                    if (payload.channelId) {
                        navigateTo = `/channels/${payload.channelId}`;
                    } else if (payload.sessionId) {
                        navigateTo = `/dms/${payload.sessionId}`;
                    }

                    console.log('[NotificationHandler] Calling showNotification:', senderName, truncatedContent);
                    const notification = showNotification(senderName, {
                        body: truncatedContent,
                        onClick: navigateTo ? () => navigate(navigateTo!) : undefined,
                    });
                    console.log('[NotificationHandler] showNotification result:', notification ? 'shown' : 'blocked');

                    // Invalidate queries to update unread counts
                    queryClient.invalidateQueries({ queryKey: ['channels'] });
                    queryClient.invalidateQueries({ queryKey: ['dms'] });
                }
            } catch (e) {
                // Ignore parse errors
            }
        };

        return () => {
            ws.onmessage = null;
            ws.onerror = null;
            ws.onclose = null;
            closeSocket(ws);
            if (socketRef.current === ws) {
                socketRef.current = null;
            }
        };
    }, [organizationId, currentUserId, showNotification, navigate, location.pathname, queryClient]);

    return null;
}
