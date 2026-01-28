import { useEffect, useMemo, useState } from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CheckCheck, Pin } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { api } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { resolveAssetUrl } from "@/lib/assets";
import MessageActions from "@/components/MessageActions";
import ReactionDisplay from "@/components/ReactionDisplay";
import MessageContent from "@/components/MessageContent";
import AttachmentList from "@/components/AttachmentList";

interface MessageListProps {
    messages: any[];
    virtuosoRef: React.RefObject<VirtuosoHandle | null>;
    onReply: (messageId: string) => void;
    channelId?: string;
    sessionId?: string;
    highlightMessageId?: string | null;
}

export default function MessageList({
    messages,
    virtuosoRef,
    onReply,
    channelId,
    sessionId,
    highlightMessageId
}: MessageListProps) {
    const queryClient = useQueryClient();
    const { data: sessionData } = authClient.useSession();
    const { toast } = useToast();
    const currentUserId = sessionData?.user?.id;
    const isDM = Boolean(sessionId);

    const { data: bookmarks = [] } = useQuery({
        queryKey: ['bookmarks'],
        queryFn: () => api.bookmarks.list()
    });

    const bookmarkedMessageIds = useMemo(() => {
        const ids = new Set<string>();
        for (const bookmark of bookmarks) {
            if (bookmark.message?.id) ids.add(bookmark.message.id);
        }
        return ids;
    }, [bookmarks]);

    const bookmarkedDmMessageIds = useMemo(() => {
        const ids = new Set<string>();
        for (const bookmark of bookmarks) {
            if (bookmark.dmMessage?.id) ids.add(bookmark.dmMessage.id);
        }
        return ids;
    }, [bookmarks]);

    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [editingContent, setEditingContent] = useState("");
    const [activeEmojiPickerId, setActiveEmojiPickerId] = useState<string | null>(null);
    const [highlightedId, setHighlightedId] = useState<string | null>(null);

    const updateMessagesCache = (updater: (messages: any[]) => any[]) => {
        const queryKey = channelId ? ['messages', channelId] : ['dm_messages', sessionId];
        queryClient.setQueryData(queryKey, (old: any) => {
            if (!old) return old;
            return { ...old, messages: updater(old.messages || []) };
        });
    };

    const editMutation = useMutation({
        mutationFn: ({ messageId, content }: { messageId: string; content: string }) =>
            channelId ? api.channels.editMessage(channelId, messageId, content) : api.dms.editMessage(sessionId!, messageId, content),
        onSuccess: (updatedMessage) => {
            updateMessagesCache((messages) =>
                messages.map((message) => message.id === updatedMessage.id ? updatedMessage : message)
            );
            setEditingMessageId(null);
            setEditingContent("");
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (messageId: string) =>
            channelId ? api.channels.deleteMessage(channelId, messageId) : api.dms.deleteMessage(sessionId!, messageId),
        onSuccess: (data, messageId) => {
            if (data && typeof data === 'object' && 'id' in data) {
                updateMessagesCache((messages) =>
                    messages.map((message) => message.id === messageId ? data : message)
                );
                return;
            }
            updateMessagesCache((messages) => messages.filter((message) => message.id !== messageId));
        }
    });

    const reactionMutation = useMutation({
        mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
            channelId ? api.channels.toggleReaction(channelId, messageId, emoji) : api.dms.toggleReaction(sessionId!, messageId, emoji),
        onSuccess: (data, variables) => {
            updateMessagesCache((messages) =>
                messages.map((message) =>
                    message.id === variables.messageId ? { ...message, reactions: data.reactions } : message
                )
            );
        }
    });

    const pinMutation = useMutation({
        mutationFn: ({ messageId, isPinned }: { messageId: string; isPinned?: boolean }) => {
            if (channelId) {
                return api.channels.togglePin(channelId, messageId, isPinned);
            }
            return api.dms.togglePin(sessionId!, messageId, isPinned);
        },
        onSuccess: (updatedMessage) => {
            updateMessagesCache((messages) =>
                messages.map((message) => message.id === updatedMessage.id ? updatedMessage : message)
            );
            if (channelId) {
                queryClient.invalidateQueries({ queryKey: ['pinned', channelId] });
            } else {
                queryClient.invalidateQueries({ queryKey: ['dm_pinned', sessionId] });
            }
        }
    });

    const bookmarkMutation = useMutation({
        mutationFn: ({ messageId, dmMessageId }: { messageId?: string; dmMessageId?: string }) =>
            api.bookmarks.toggle({ messageId, dmMessageId }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
        }
    });

    const handleEdit = (message: any) => {
        setEditingMessageId(message.id);
        setEditingContent(message.content);
    };

    const handleSaveEdit = (messageId: string) => {
        if (!editingContent.trim()) return;
        editMutation.mutate({ messageId, content: editingContent });
    };

    const handleDelete = (message: any) => {
        if (!window.confirm('Delete this message?')) return;
        deleteMutation.mutate(message.id);
    };

    const sortedMessages = useMemo(
        () => [...messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
        [messages]
    );

    useEffect(() => {
        if (!highlightMessageId || sortedMessages.length === 0) return;
        const targetIndex = sortedMessages.findIndex((message) => message.id === highlightMessageId);
        if (targetIndex < 0) return;

        setHighlightedId(highlightMessageId);
        const timeout = setTimeout(() => {
            setHighlightedId((current) => (current === highlightMessageId ? null : current));
        }, 2500);

        requestAnimationFrame(() => {
            virtuosoRef.current?.scrollToIndex({ index: targetIndex, align: 'center' });
        });

        return () => clearTimeout(timeout);
    }, [highlightMessageId, sortedMessages, virtuosoRef]);

    return (
        <Virtuoso
            ref={virtuosoRef}
            data={sortedMessages}
            initialTopMostItemIndex={sortedMessages.length - 1}
            itemContent={(_index, msg) => (
                <div
                    className={`flex flex-col py-2 group -mx-4 px-4 rounded transition-colors hover:bg-black/5 ${msg.id === highlightedId ? "bg-amber-50 ring-1 ring-amber-200" : ""}`}
                >
                    <div className="flex items-start">
                        <Avatar className="h-9 w-9 mr-2 mt-1 rounded-sm">
                            <AvatarImage src={resolveAssetUrl(msg.sender?.image)} />
                            <AvatarFallback>{msg.sender?.name?.[0]}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center">
                                <span className="font-bold mr-2">{msg.sender?.name}</span>
                                <span className="text-xs text-gray-400">
                                    {new Date(msg.createdAt).toLocaleTimeString()}
                                </span>
                                {msg.isPinned && (
                                    <span className="ml-2 inline-flex items-center text-xs text-blue-600">
                                        <Pin className="mr-1 h-3 w-3" />
                                        Pinned
                                    </span>
                                )}
                                {isDM && msg.senderId === currentUserId && (
                                    <span className="ml-2 inline-flex items-center text-xs text-gray-400">
                                        {msg.readBy?.some((id: string) => id !== currentUserId) ? (
                                            <>
                                                <CheckCheck className="mr-1 h-3 w-3 text-blue-500" />
                                                Read
                                            </>
                                        ) : (
                                            <>
                                                <Check className="mr-1 h-3 w-3" />
                                                Sent
                                            </>
                                        )}
                                    </span>
                                )}
                                {msg.isEdited && (
                                    <span className="ml-2 text-xs text-gray-400">(edited)</span>
                                )}
                            </div>
                            {editingMessageId === msg.id ? (
                                <form
                                    className="mt-2 space-y-2"
                                    onSubmit={(event) => {
                                        event.preventDefault();
                                        handleSaveEdit(msg.id);
                                    }}
                                >
                                    <Input
                                        value={editingContent}
                                        onChange={(event) => setEditingContent(event.target.value)}
                                        className="text-sm"
                                    />
                                    <div className="flex gap-2">
                                        <Button
                                            type="submit"
                                            size="sm"
                                            disabled={editMutation.isPending}
                                        >
                                            Save
                                        </Button>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => {
                                                setEditingMessageId(null);
                                                setEditingContent("");
                                            }}
                                        >
                                            Cancel
                                        </Button>
                                    </div>
                                </form>
                            ) : (
                                <MessageContent
                                    content={msg.content}
                                    mentions={msg.mentions}
                                    className="text-gray-900 break-words"
                                />
                            )}
                            <AttachmentList attachments={msg.attachments} />

                            <ReactionDisplay
                                reactions={msg.reactions || []}
                                currentUserId={currentUserId}
                                onToggle={(emoji) => reactionMutation.mutate({ messageId: msg.id, emoji })}
                            />

                            {/* Reply Count Indicator */}
                            {msg._count?.replies > 0 && (
                                <div
                                    className="mt-1 flex items-center cursor-pointer"
                                    onClick={() => onReply(msg.id)}
                                >
                                    <div className="flex items-center gap-1 bg-white border border-gray-200 rounded p-1 shadow-sm hover:bg-gray-50">
                                        <Avatar className="h-4 w-4">
                                            <AvatarImage src={resolveAssetUrl(msg.sender?.image)} />
                                        </Avatar>
                                        <span className="text-blue-600 text-xs font-semibold">{msg._count.replies} replies</span>
                                        <span className="text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">View thread</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Action Buttons (Visible on Hover) */}
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity relative -top-2">
                            <MessageActions
                                canEdit={msg.senderId === currentUserId}
                                canDelete={msg.senderId === currentUserId}
                                isEmojiPickerOpen={activeEmojiPickerId === msg.id}
                                isPinned={Boolean(msg.isPinned)}
                                isBookmarked={isDM ? bookmarkedDmMessageIds.has(msg.id) : bookmarkedMessageIds.has(msg.id)}
                                onReply={() => onReply(msg.id)}
                                onEdit={() => handleEdit(msg)}
                                onDelete={() => handleDelete(msg)}
                                onReact={(emoji) => reactionMutation.mutate({ messageId: msg.id, emoji })}
                                onToggleEmojiPicker={() => {
                                    setActiveEmojiPickerId((activeId) => activeId === msg.id ? null : msg.id);
                                }}
                                onPin={() => pinMutation.mutate({ messageId: msg.id })}
                                onBookmark={() => bookmarkMutation.mutate(isDM ? { dmMessageId: msg.id } : { messageId: msg.id })}
                            />
                        </div>
                    </div>
                </div>
            )}
        />
    );
}
