import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, API_URL } from '@/lib/api-client';
import { useOrganization } from './OrganizationContext';
import { authClient } from '@/lib/auth-client';

export type PresenceStatus = 'online' | 'away' | 'offline';

interface PresenceContextType {
    presence: Record<string, PresenceStatus>;
    getPresence: (userId: string) => PresenceStatus;
}

const PresenceContext = createContext<PresenceContextType | undefined>(undefined);

const WS_URL = API_URL.replace('http', 'ws') + '/ws';

// Activity update interval (1 minute)
const ACTIVITY_INTERVAL_MS = 60 * 1000;

// Reconnection configuration
const INITIAL_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;
const RECONNECT_BACKOFF_MULTIPLIER = 2;

// Throttle activity events to avoid excessive sends
const ACTIVITY_THROTTLE_MS = 10000;

export function PresenceProvider({ children }: { children: ReactNode }) {
    const queryClient = useQueryClient();
    const socketRef = useRef<WebSocket | null>(null);
    const activityIntervalRef = useRef<number | null>(null);
    const { currentOrganization } = useOrganization();
    const { data: sessionData } = authClient.useSession();
    const currentUserId = sessionData?.user?.id;
    const organizationId = currentOrganization?.id;

    const [presence, setPresence] = useState<Record<string, PresenceStatus>>({});

    // Reconnection state
    const reconnectAttemptRef = useRef(0);
    const reconnectTimeoutRef = useRef<number | null>(null);
    const intentionalCloseRef = useRef(false);
    const lastActivitySentRef = useRef(0);

    // Fetch initial presence
    const { data: initialPresence } = useQuery({
        queryKey: ['presence', organizationId],
        queryFn: () => api.users.presence(),
        enabled: !!organizationId,
        refetchInterval: 30000, // Refresh every 30 seconds as backup
    });

    // Update presence state when initial data changes
    useEffect(() => {
        if (initialPresence) {
            setPresence(initialPresence);
        }
    }, [initialPresence]);

    // WebSocket connection for presence updates
    useEffect(() => {
        if (!organizationId || !currentUserId) return;

        intentionalCloseRef.current = false;
        reconnectAttemptRef.current = 0;

        const closeSocket = (socket: WebSocket) => {
            if (socket.readyState === WebSocket.CONNECTING) {
                socket.addEventListener('open', () => socket.close(), { once: true });
                return;
            }
            if (socket.readyState === WebSocket.OPEN) {
                socket.close();
            }
        };

        const getReconnectDelay = () => {
            const delay = INITIAL_RECONNECT_DELAY_MS * Math.pow(RECONNECT_BACKOFF_MULTIPLIER, reconnectAttemptRef.current);
            return Math.min(delay, MAX_RECONNECT_DELAY_MS);
        };

        const connect = () => {
            // Cleanup previous socket
            if (socketRef.current) {
                closeSocket(socketRef.current);
            }

            // Clear any pending reconnect timeout
            if (reconnectTimeoutRef.current) {
                window.clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
            }

            const params = new URLSearchParams();
            params.append('userId', currentUserId);
            params.append('organizationId', organizationId);

            const ws = new WebSocket(`${WS_URL}?${params.toString()}`);
            socketRef.current = ws;

            // Send activity updates periodically to stay "online"
            const sendActivity = () => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'ACTIVITY' }));
                    lastActivitySentRef.current = Date.now();
                }
            };

            // Throttled activity sender for user interaction events
            const sendActivityThrottled = () => {
                const now = Date.now();
                if (now - lastActivitySentRef.current >= ACTIVITY_THROTTLE_MS) {
                    sendActivity();
                }
            };

            ws.onopen = () => {
                reconnectAttemptRef.current = 0; // Reset on successful connection
                sendActivity();

                // Start activity interval
                if (activityIntervalRef.current) {
                    window.clearInterval(activityIntervalRef.current);
                }
                activityIntervalRef.current = window.setInterval(sendActivity, ACTIVITY_INTERVAL_MS);
            };

            ws.onmessage = (event) => {
                try {
                    const payload = JSON.parse(event.data);

                    // Handle PING from server - respond with PONG
                    if (payload.type === 'PING') {
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({ type: 'PONG', timestamp: payload.timestamp }));
                        }
                        return;
                    }

                    if (payload.type === 'PRESENCE' && payload.organizationId === organizationId) {
                        setPresence(payload.presence);
                        queryClient.setQueryData(['presence', organizationId], payload.presence);
                    }
                } catch (e) {
                    console.error('Presence WS Error', e);
                }
            };

            ws.onerror = () => {
                // Error will be followed by close event
            };

            ws.onclose = () => {
                // Clear activity interval
                if (activityIntervalRef.current) {
                    window.clearInterval(activityIntervalRef.current);
                    activityIntervalRef.current = null;
                }

                // Only reconnect if this wasn't an intentional close
                if (!intentionalCloseRef.current) {
                    reconnectAttemptRef.current++;
                    const delay = getReconnectDelay();
                    reconnectTimeoutRef.current = window.setTimeout(() => {
                        if (!intentionalCloseRef.current) {
                            connect();
                        }
                    }, delay);
                }
            };

            // Also send activity on user interaction (throttled)
            window.addEventListener('mousemove', sendActivityThrottled, { passive: true });
            window.addEventListener('keydown', sendActivityThrottled, { passive: true });

            // Store cleanup function for user activity listeners
            return () => {
                window.removeEventListener('mousemove', sendActivityThrottled);
                window.removeEventListener('keydown', sendActivityThrottled);
            };
        };

        // Initial connection
        const cleanupUserActivity = connect();

        return () => {
            intentionalCloseRef.current = true;

            // Clear reconnect timeout
            if (reconnectTimeoutRef.current) {
                window.clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
            }

            // Clear activity interval
            if (activityIntervalRef.current) {
                window.clearInterval(activityIntervalRef.current);
                activityIntervalRef.current = null;
            }

            // Remove user activity listeners
            if (cleanupUserActivity) {
                cleanupUserActivity();
            }

            const ws = socketRef.current;
            if (ws) {
                ws.onopen = null;
                ws.onmessage = null;
                ws.onerror = null;
                ws.onclose = null;
                closeSocket(ws);
                socketRef.current = null;
            }
        };
    }, [organizationId, currentUserId, queryClient]);

    const getPresence = useCallback((userId: string): PresenceStatus => {
        return presence[userId] || 'offline';
    }, [presence]);

    return (
        <PresenceContext.Provider value={{ presence, getPresence }}>
            {children}
        </PresenceContext.Provider>
    );
}

export function usePresence() {
    const context = useContext(PresenceContext);
    if (context === undefined) {
        throw new Error('usePresence must be used within a PresenceProvider');
    }
    return context;
}
