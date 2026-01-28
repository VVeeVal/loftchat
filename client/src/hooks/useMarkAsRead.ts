import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, APIError } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";

type MarkAsReadConfig = {
    channelId?: string;
    sessionId?: string;
    messageCount: number;
    shouldMarkRead?: boolean;
};

/**
 * Marks a channel or DM as read when:
 * 1. User navigates to it (id changes)
 * 2. New messages arrive while viewing (message count increases)
 */
export function useMarkAsRead({ channelId, sessionId, messageCount, shouldMarkRead }: MarkAsReadConfig) {
    const queryClient = useQueryClient();
    const { data: session } = authClient.useSession();
    const prevCountRef = useRef(0);
    const prevIdRef = useRef<string | undefined>();

    useEffect(() => {
        if (!session?.user?.id) return;
        const id = channelId || sessionId;
        if (!id) return;

        if (channelId && shouldMarkRead === false) {
            return;
        }

        const idChanged = id !== prevIdRef.current;
        const countIncreased = messageCount > prevCountRef.current;

        // Update refs
        prevIdRef.current = id;
        prevCountRef.current = messageCount;

        // Only mark as read if id changed or new messages arrived
        if (!idChanged && !countIncreased) return;

        // Reset count tracking when id changes
        if (idChanged) {
            prevCountRef.current = messageCount;
        }

        const markRead = channelId
            ? () => api.channels.markRead(channelId)
            : () => api.dms.markRead(sessionId!);

        const queryKey = channelId ? ['channels'] : ['dms'];

        markRead()
            .then(() => {
                queryClient.invalidateQueries({ queryKey });
            })
            .catch((err) => {
                if (err instanceof APIError && (err.statusCode === 401 || err.statusCode === 400)) {
                    return;
                }
                console.error('Failed to mark as read:', err);
            });
    }, [channelId, sessionId, messageCount, queryClient, session?.user?.id, shouldMarkRead]);
}
