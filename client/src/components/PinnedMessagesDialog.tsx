import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Pin } from "lucide-react";

interface PinnedMessagesDialogProps {
    channelId?: string;
    sessionId?: string;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

export function PinnedMessagesDialog({ channelId, sessionId, isOpen, onOpenChange }: PinnedMessagesDialogProps) {
    const queryClient = useQueryClient();
    const isChannel = Boolean(channelId);
    const targetId = channelId ?? sessionId;
    const { data: pinnedMessages = [], isLoading } = useQuery({
        queryKey: isChannel ? ['pinned', channelId] : ['dm_pinned', sessionId],
        queryFn: () => {
            if (channelId) return api.channels.pinned(channelId);
            if (sessionId) return api.dms.pinned(sessionId);
            return Promise.resolve([]);
        },
        enabled: isOpen && Boolean(targetId)
    });

    const unpinMutation = useMutation({
        mutationFn: (messageId: string) => {
            if (channelId) return api.channels.togglePin(channelId, messageId, false);
            return api.dms.togglePin(sessionId!, messageId, false);
        },
        onSuccess: () => {
            if (channelId) {
                queryClient.invalidateQueries({ queryKey: ['pinned', channelId] });
                queryClient.invalidateQueries({ queryKey: ['messages', channelId] });
            } else {
                queryClient.invalidateQueries({ queryKey: ['dm_pinned', sessionId] });
                queryClient.invalidateQueries({ queryKey: ['dm_messages', sessionId] });
            }
        }
    });

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-[640px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Pin className="h-4 w-4 text-blue-600" />
                        Pinned Messages
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        View pinned messages for this channel.
                    </DialogDescription>
                </DialogHeader>

                <div className="max-h-[60vh] overflow-y-auto space-y-3">
                    {isLoading && <p className="text-sm text-gray-500">Loading pinned messages...</p>}
                    {!isLoading && pinnedMessages.length === 0 && (
                        <p className="text-sm text-gray-500">No pinned messages yet.</p>
                    )}
                    {pinnedMessages.map((message: any) => (
                        <div key={message.id} className="rounded border p-3 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                                <div className="text-xs text-gray-500">
                                    {message.sender?.name || message.sender?.email} · {new Date(message.createdAt).toLocaleString()}
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => unpinMutation.mutate(message.id)}
                                    disabled={unpinMutation.isPending}
                                >
                                    Unpin
                                </Button>
                            </div>
                            <Link
                                to={channelId ? `/channels/${channelId}?messageId=${message.id}` : `/dms/${sessionId}?messageId=${message.id}`}
                                className="block text-sm text-gray-800 hover:underline"
                            >
                                {message.content}
                            </Link>
                        </div>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    );
}
