import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { API_URL } from "@/lib/api-client";

const WS_URL = API_URL.replace('http', 'ws') + '/ws';

type TypingUser = { id: string; name: string };

type TypingState = { name: string; lastUpdated: number };
type TypingLabels = Record<string, string>;

// Reconnection configuration
const INITIAL_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;
const RECONNECT_BACKOFF_MULTIPLIER = 2;

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

export function useChatSocket(channelId?: string, sessionId?: string, currentUserId?: string) {
    const queryClient = useQueryClient();
    const socketRef = useRef<WebSocket | null>(null);
    const typingByScopeRef = useRef<Map<string, Map<string, TypingState>>>(new Map());
    const [typingLabels, setTypingLabels] = useState<TypingLabels>({});
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');

    // Reconnection state
    const reconnectAttemptRef = useRef(0);
    const reconnectTimeoutRef = useRef<number | null>(null);
    const intentionalCloseRef = useRef(false);

    useEffect(() => {
        if (!channelId && !sessionId) return;

        typingByScopeRef.current.clear();
        setTypingLabels({});
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
            if (channelId) params.append('channelId', channelId);
            if (sessionId) params.append('sessionId', sessionId);

            setConnectionStatus(reconnectAttemptRef.current > 0 ? 'reconnecting' : 'connecting');
            const ws = new WebSocket(`${WS_URL}?${params.toString()}`);
            socketRef.current = ws;

            ws.onopen = () => {
                setConnectionStatus('connected');
                reconnectAttemptRef.current = 0; // Reset on successful connection
            };

            const updateChannelMessages = (updater: (messages: any[]) => any[]) => {
                queryClient.setQueryData(['messages', channelId], (old: any) => {
                    if (!old) return old;
                    return { ...old, messages: updater(old.messages || []) };
                });
            };

            const updateDMMessages = (updater: (messages: any[]) => any[]) => {
                queryClient.setQueryData(['dm_messages', sessionId], (old: any) => {
                    if (!old) return old;
                    return { ...old, messages: updater(old.messages || []) };
                });
            };

            const buildLabel = (users: TypingUser[]) => {
                if (users.length === 0) return '';
                if (users.length === 1) return `${users[0].name} is typing...`;
                if (users.length === 2) return `${users[0].name} and ${users[1].name} are typing...`;
                const [first, second] = users;
                const remaining = users.length - 2;
                return `${first.name}, ${second.name}, and ${remaining} others are typing...`;
            };

            const updateTypingLabel = (scopeKey: string) => {
                const scopeMap = typingByScopeRef.current.get(scopeKey);
                const users: TypingUser[] = [];
                if (scopeMap) {
                    for (const [id, value] of scopeMap.entries()) {
                        users.push({ id, name: value.name });
                    }
                }
                const label = buildLabel(users);
                setTypingLabels((prev) => {
                    if (prev[scopeKey] === label) return prev;
                    return { ...prev, [scopeKey]: label };
                });
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

                    // Handle Channel Messages
                    if (payload.type === 'INSERT' && channelId && payload.channelId === channelId) {
                        updateChannelMessages((messages) => {
                            const newMessage = payload.message;
                            if (newMessage?.threadId) return messages;
                            const exists = messages.find((m: any) => m.id === newMessage.id);
                            if (exists) return messages;
                            return [...messages, newMessage];
                        });
                    }

                    // Handle DM Messages
                    if (payload.type === 'INSERT' && sessionId && payload.sessionId === sessionId) {
                        updateDMMessages((messages) => {
                            const newMessage = payload.message;
                            if (newMessage?.threadId) return messages;
                            const exists = messages.find((m: any) => m.id === newMessage.id);
                            if (exists) return messages;
                            return [...messages, newMessage];
                        });
                    }

                    if (payload.type === 'UPDATE' && channelId && payload.channelId === channelId) {
                        updateChannelMessages((messages) =>
                            messages.map((message: any) => message.id === payload.message.id ? payload.message : message)
                        );
                    }

                    if (payload.type === 'UPDATE' && sessionId && payload.sessionId === sessionId) {
                        updateDMMessages((messages) =>
                            messages.map((message: any) => message.id === payload.message.id ? payload.message : message)
                        );
                    }

                    if (payload.type === 'DELETE' && channelId && payload.channelId === channelId) {
                        updateChannelMessages((messages) =>
                            messages.filter((message: any) => message.id !== payload.messageId)
                        );
                    }

                    if (payload.type === 'DELETE' && sessionId && payload.sessionId === sessionId) {
                        updateDMMessages((messages) =>
                            messages.filter((message: any) => message.id !== payload.messageId)
                        );
                    }

                    if (payload.type === 'REACTION' && channelId && payload.channelId === channelId) {
                        updateChannelMessages((messages) =>
                            messages.map((message: any) => message.id === payload.messageId ? { ...message, reactions: payload.reactions } : message)
                        );
                    }

                    if (payload.type === 'REACTION' && sessionId && payload.sessionId === sessionId) {
                        updateDMMessages((messages) =>
                            messages.map((message: any) => message.id === payload.messageId ? { ...message, reactions: payload.reactions } : message)
                        );
                    }

                    if (payload.type === 'TYPING') {
                        if (channelId && payload.channelId !== channelId) return;
                        if (sessionId && payload.sessionId !== sessionId) return;
                        if (payload.user?.id && payload.user.id === currentUserId) return;

                        const scopeKey = payload.threadId ? `thread:${payload.threadId}` : 'main';
                        const userId = typeof payload.user?.id === 'string' ? payload.user.id : '';
                        const userName = typeof payload.user?.name === 'string' && payload.user.name.trim().length > 0
                            ? payload.user.name
                            : 'Someone';
                        if (!userId) return;

                        let scopeMap = typingByScopeRef.current.get(scopeKey);
                        if (!scopeMap) {
                            scopeMap = new Map<string, TypingState>();
                            typingByScopeRef.current.set(scopeKey, scopeMap);
                        }

                        if (payload.isTyping) {
                            scopeMap.set(userId, { name: userName, lastUpdated: Date.now() });
                        } else {
                            scopeMap.delete(userId);
                        }

                        updateTypingLabel(scopeKey);
                    }
                } catch (e) {
                    console.error('WS Error', e);
                }
            };

            ws.onerror = () => {
                // Error will be followed by close event
            };

            ws.onclose = () => {
                setConnectionStatus('disconnected');

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
        };

        // Initial connection
        connect();

        return () => {
            intentionalCloseRef.current = true;

            // Clear reconnect timeout
            if (reconnectTimeoutRef.current) {
                window.clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
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

            setConnectionStatus('disconnected');
        };
    }, [channelId, sessionId, queryClient, currentUserId]);

    useEffect(() => {
        const interval = window.setInterval(() => {
            const now = Date.now();
            const scopesToUpdate: string[] = [];
            for (const [scopeKey, scopeMap] of typingByScopeRef.current.entries()) {
                let changed = false;
                for (const [id, value] of scopeMap.entries()) {
                    if (now - value.lastUpdated > 4000) {
                        scopeMap.delete(id);
                        changed = true;
                    }
                }
                if (changed) {
                    scopesToUpdate.push(scopeKey);
                }
                if (scopeMap.size === 0) {
                    typingByScopeRef.current.delete(scopeKey);
                }
            }

            if (scopesToUpdate.length > 0) {
                setTypingLabels((prev) => {
                    const next = { ...prev };
                    for (const scopeKey of scopesToUpdate) {
                        const scopeMap = typingByScopeRef.current.get(scopeKey);
                        const users: TypingUser[] = [];
                        if (scopeMap) {
                            for (const [id, value] of scopeMap.entries()) {
                                users.push({ id, name: value.name });
                            }
                        }
                        const label = users.length === 0 ? '' : (
                            users.length === 1 ? `${users[0].name} is typing...`
                                : users.length === 2
                                    ? `${users[0].name} and ${users[1].name} are typing...`
                                    : `${users[0].name}, ${users[1].name}, and ${users.length - 2} others are typing...`
                        );
                        next[scopeKey] = label;
                    }
                    return next;
                });
            }
        }, 2000);

        return () => window.clearInterval(interval);
    }, []);

    const sendTyping = useCallback((isTyping: boolean, user: TypingUser, typingThreadId?: string) => {
        const socket = socketRef.current;
        if (!socket || socket.readyState !== WebSocket.OPEN) return;
        if (!channelId && !sessionId) return;
        if (!user?.id) return;

        socket.send(JSON.stringify({
            type: 'TYPING',
            channelId,
            sessionId,
            threadId: typingThreadId,
            user,
            isTyping
        }));
    }, [channelId, sessionId]);

    const typingLabel = useMemo(() => typingLabels.main || '', [typingLabels]);

    const typingLabelForThread = useCallback((typingThreadId?: string) => {
        if (!typingThreadId) return '';
        return typingLabels[`thread:${typingThreadId}`] || '';
    }, [typingLabels]);

    return { sendTyping, typingLabel, typingLabelForThread, connectionStatus };
}
