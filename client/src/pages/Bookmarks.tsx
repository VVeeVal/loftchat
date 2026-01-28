import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Bookmark, Hash, MessageSquare } from "lucide-react";

export default function Bookmarks() {
    const queryClient = useQueryClient();
    const { data: bookmarks = [], isLoading } = useQuery({
        queryKey: ['bookmarks'],
        queryFn: () => api.bookmarks.list()
    });

    const toggleMutation = useMutation({
        mutationFn: ({ messageId, dmMessageId }: { messageId?: string; dmMessageId?: string }) =>
            api.bookmarks.toggle({ messageId, dmMessageId }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
        }
    });

    const buildLink = (bookmark: any) => {
        if (bookmark.message) {
            const params = new URLSearchParams();
            params.set("messageId", bookmark.message.id);
            if (bookmark.message.threadId) params.set("threadId", bookmark.message.threadId);
            return `/channels/${bookmark.message.channel?.id}?${params.toString()}`;
        }

        if (bookmark.dmMessage) {
            const params = new URLSearchParams();
            params.set("messageId", bookmark.dmMessage.id);
            if (bookmark.dmMessage.threadId) params.set("threadId", bookmark.dmMessage.threadId);
            return `/dms/${bookmark.dmMessage.session?.id}?${params.toString()}`;
        }

        return "#";
    };

    if (isLoading) {
        return (
            <div className="flex flex-col h-full items-center justify-center">
                <div className="flex items-center gap-2 text-muted-foreground">
                    <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                    <span>Loading bookmarks...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="h-14 border-b border-border/50 flex items-center px-4 shrink-0 bg-white/80 dark:bg-card/80 backdrop-blur-sm">
                <Bookmark className="h-5 w-5 mr-2 text-primary" />
                <h1 className="font-semibold text-lg">Bookmarks</h1>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                {bookmarks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center mt-20">
                        <div className="bg-secondary/50 p-6 rounded-full mb-4">
                            <Bookmark className="h-12 w-12 text-muted-foreground" />
                        </div>
                        <h2 className="text-xl font-semibold mb-2">No bookmarks yet</h2>
                        <p className="text-muted-foreground max-w-md">
                            Save important messages for easy access later by bookmarking them.
                        </p>
                    </div>
                ) : (
                    <div className="max-w-3xl space-y-3">
                        {bookmarks.map((bookmark: any) => {
                            const message = bookmark.message || bookmark.dmMessage;
                            const locationLabel = bookmark.message
                                ? `#${bookmark.message.channel?.name || "channel"}`
                                : "Direct Message";
                            const isChannel = !!bookmark.message;
                            return (
                                <div key={bookmark.id} className="rounded-xl border border-border/50 p-4 bg-white/80 dark:bg-card/80 backdrop-blur-sm shadow-sm hover:shadow-cloud transition-shadow">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <span className="font-medium">{message?.sender?.name || message?.sender?.email}</span>
                                            <span>·</span>
                                            <div className="flex items-center bg-secondary/50 px-2 py-0.5 rounded-md">
                                                {isChannel ? (
                                                    <Hash className="h-3 w-3 mr-1" />
                                                ) : (
                                                    <MessageSquare className="h-3 w-3 mr-1" />
                                                )}
                                                {locationLabel}
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-muted-foreground hover:text-destructive"
                                            onClick={() => toggleMutation.mutate(
                                                bookmark.message
                                                    ? { messageId: bookmark.message.id }
                                                    : { dmMessageId: bookmark.dmMessage?.id }
                                            )}
                                            disabled={toggleMutation.isPending}
                                        >
                                            Remove
                                        </Button>
                                    </div>
                                    <Link to={buildLink(bookmark)} className="text-sm hover:text-primary transition-colors">
                                        {message?.content}
                                    </Link>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
