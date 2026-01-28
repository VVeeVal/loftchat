import { useQuery } from "@tanstack/react-query";
import { MessageSquareText, Hash, User as UserIcon } from "lucide-react";
import { api } from "@/lib/api-client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { resolveAssetUrl } from "@/lib/assets";

export default function Threads() {
    const { data: threads, isLoading } = useQuery({
        queryKey: ['threads'],
        queryFn: () => api.threads.list(),
        refetchInterval: 5000
    });

    if (isLoading) {
        return (
            <div className="flex flex-col h-full items-center justify-center">
                <div className="flex items-center gap-2 text-muted-foreground">
                    <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                    <span>Loading threads...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="h-14 border-b border-border/50 flex items-center px-4 shrink-0 bg-white/80 dark:bg-card/80 backdrop-blur-sm">
                <MessageSquareText className="h-5 w-5 mr-2 text-primary" />
                <h1 className="font-semibold text-lg">Threads</h1>
            </div>

            <div className="flex-1 overflow-y-auto">
                {!threads || threads.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center mt-20">
                        <div className="bg-secondary/50 p-6 rounded-full mb-4">
                            <MessageSquareText className="h-12 w-12 text-muted-foreground" />
                        </div>
                        <h2 className="text-xl font-semibold mb-2">No threads yet</h2>
                        <p className="text-muted-foreground max-w-md">
                            When you reply to a message or someone replies to yours, they'll show up here.
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-border/50">
                        {threads.map((thread: any) => (
                            <Link
                                key={thread.id}
                                to={thread.type === 'channel' ? `/channels/${thread.location.id}?threadId=${thread.id}` : `/dms/${thread.location.id}?threadId=${thread.id}`}
                                className="block hover:bg-accent/50 transition-colors p-4"
                            >
                                <div className="flex items-start gap-3">
                                    <Avatar className="h-10 w-10 mt-1 ring-2 ring-white/50 dark:ring-white/20">
                                        <AvatarImage src={resolveAssetUrl(thread.sender?.image)} />
                                        <AvatarFallback className="bg-gradient-to-br from-loft-mint to-primary text-white">
                                            <UserIcon className="h-5 w-5" />
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-semibold text-sm truncate">{thread.sender?.name || thread.sender?.email}</span>
                                            <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                                                {formatDistanceToNow(new Date(thread.updatedAt), { addSuffix: true })}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 mb-2">
                                            {thread.type === 'channel' ? (
                                                <div className="flex items-center text-xs text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-md">
                                                    <Hash className="h-3 w-3 mr-1" />
                                                    {thread.location.name}
                                                </div>
                                            ) : (
                                                <div className="flex items-center text-xs text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-md">
                                                    <UserIcon className="h-3 w-3 mr-1" />
                                                    {thread.location.name}
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-sm line-clamp-2 mb-2">
                                            {thread.content}
                                        </p>

                                        {thread.latestReply && (
                                            <div className="bg-secondary/30 border border-border/50 rounded-lg p-3 mt-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Avatar className="h-5 w-5">
                                                        <AvatarImage src={resolveAssetUrl(thread.latestReply.sender?.image)} />
                                                        <AvatarFallback className="text-[10px] bg-gradient-to-br from-loft-mint to-primary text-white">{thread.latestReply.sender?.name?.[0]}</AvatarFallback>
                                                    </Avatar>
                                                    <span className="text-xs font-medium">{thread.latestReply.sender?.name}</span>
                                                    <span className="text-xs text-muted-foreground">replied</span>
                                                </div>
                                                <p className="text-xs text-muted-foreground line-clamp-1 italic">
                                                    "{thread.latestReply.content}"
                                                </p>
                                            </div>
                                        )}

                                        <div className="mt-2 text-xs text-primary font-medium">
                                            {thread.replyCount} {thread.replyCount === 1 ? 'reply' : 'replies'}
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
