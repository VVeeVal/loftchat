import { useRef, useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useChatSocket } from "@/hooks/useChatSocket";
import { useMarkAsRead } from "@/hooks/useMarkAsRead";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { type VirtuosoHandle } from "react-virtuoso";
import { cn } from "@/lib/utils";
import ThreadPanel from "@/components/ThreadPanel";
import MessageList from "@/components/MessageList";
import ChatInput from "@/components/ChatInput";
import { ChannelDetailsDialog } from "@/components/ChannelDetailsDialog";
import { useToast } from "@/hooks/use-toast";
import { Archive, Hash, Lock, Pin } from "lucide-react";
import type { Attachment, NotificationPreference } from "@/types/api";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { PinnedMessagesDialog } from "@/components/PinnedMessagesDialog";

export default function Chat() {
    const { channelId } = useParams();
    const [searchParams] = useSearchParams();
    const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [isPinnedOpen, setIsPinnedOpen] = useState(false);
    const [highlightMessageId, setHighlightMessageId] = useState<string | null>(null);
    const [threadHighlightId, setThreadHighlightId] = useState<string | null>(null);
    const [searchHandled, setSearchHandled] = useState(false);
    const queryClient = useQueryClient();
    const virtuosoRef = useRef<VirtuosoHandle>(null);
    const { toast } = useToast();
    const { isMobile } = useMediaQuery();
    const messageIdParam = searchParams.get("messageId");
    const threadIdParam = searchParams.get("threadId");
    const { data: sessionData } = authClient.useSession();
    const currentUser = sessionData?.user;

    // Connect to WS
    const { sendTyping, typingLabel, typingLabelForThread } = useChatSocket(channelId, undefined, currentUser?.id);

    const { data, isLoading, error } = useQuery({
        queryKey: ['messages', channelId],
        queryFn: () => api.channels.get(channelId!),
        enabled: !!channelId
    });

    const messages = data?.messages || [];
    const channel = data?.channel;
    const isChannelMember = Boolean(channel?.members?.some((member: any) => member.userId === currentUser?.id));

    useMarkAsRead({
        channelId: channel?.id,
        messageCount: messages.length,
        shouldMarkRead: isChannelMember
    });

    const { data: users = [] } = useQuery({
        queryKey: ['users'],
        queryFn: () => api.users.list(),
        enabled: isDetailsOpen
    });

    const sendMutation = useMutation({
        mutationFn: ({ content, attachments }: { content: string; attachments: Attachment[] }) =>
            api.channels.sendMessage(channelId!, content, undefined, attachments),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['messages', channelId] });
            setTimeout(() => {
                virtuosoRef.current?.scrollToIndex({ index: data?.messages?.length || 0, align: 'end' });
            }, 100);
        }
    });

    const addMemberMutation = useMutation({
        mutationFn: (userId: string) => api.channels.addMember(channelId!, userId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['messages', channelId] });
            toast({ title: 'User added to channel' });
        },
        onError: (err: any) => {
            toast({ title: err?.message || 'Failed to add user', variant: 'destructive' });
        }
    });

    const updateNotificationMutation = useMutation({
        mutationFn: (preference: NotificationPreference) =>
            api.channels.updateNotificationPreference(channelId!, preference),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['channels'] });
            queryClient.invalidateQueries({ queryKey: ['messages', channelId] });
        }
    });

    const archiveMutation = useMutation({
        mutationFn: (isArchived: boolean) => api.channels.archive(channelId!, isArchived),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['channels'] });
            queryClient.invalidateQueries({ queryKey: ['messages', channelId] });
        }
    });

    const handleSend = (messageContent: string, attachments: Attachment[]) => {
        sendMutation.mutate({ content: messageContent, attachments });
    };

    useEffect(() => {
        setSearchHandled(false);
        setHighlightMessageId(null);
        setThreadHighlightId(null);
    }, [channelId, messageIdParam, threadIdParam]);

    useEffect(() => {
        if (!threadIdParam || messageIdParam || searchHandled) return;
        setActiveThreadId(threadIdParam);
        setSearchHandled(true);
    }, [threadIdParam, messageIdParam, searchHandled]);

    useEffect(() => {
        if (!messageIdParam || searchHandled || messages.length === 0) return;

        const isInMain = messages.some((message: any) => message.id === messageIdParam);
        if (isInMain) {
            setHighlightMessageId(messageIdParam);
            setSearchHandled(true);
            return;
        }

        if (threadIdParam) {
            setActiveThreadId(threadIdParam);
            setThreadHighlightId(messageIdParam);
            setSearchHandled(true);
            return;
        }

        toast({
            title: "Message not loaded",
            description: "This message is older than the current history window."
        });
        setSearchHandled(true);
    }, [messageIdParam, threadIdParam, messages, searchHandled, toast]);

    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="flex items-center gap-2 text-muted-foreground">
                    <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                    <span>Loading messages...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="text-destructive">Error loading channel</div>
            </div>
        );
    }

    if (!data || !channel) return null;

    const currentPreference = channel?.members?.find((member: any) => member.userId === currentUser?.id)
        ?.notificationPreference ?? channel?.notificationPreference ?? "ALL";

    return (
        <div className="flex h-full w-full overflow-hidden">
            {/* Main Chat Area */}
            <div className={cn(
                "flex-1 flex flex-col min-w-0",
                // Hide main chat on mobile when thread is open
                isMobile && activeThreadId && "hidden"
            )}>
                {/* Header */}
                <div
                    className="h-14 border-b border-border/50 flex items-center px-2 sm:px-4 bg-white/80 dark:bg-card/80 backdrop-blur-sm z-10 flex-shrink-0 cursor-pointer hover:bg-white/90 dark:hover:bg-card/90 transition-colors"
                    onClick={() => setIsDetailsOpen(true)}
                >
                    <div className="flex items-center min-w-0 flex-1">
                        {channel.isPrivate ? (
                            <Lock className="h-4 w-4 mr-2 text-muted-foreground flex-shrink-0" />
                        ) : (
                            <Hash className="h-4 w-4 mr-2 text-primary flex-shrink-0" />
                        )}
                        <h2 className="font-semibold truncate">{channel.name}</h2>
                        {channel.description && (
                            <span className="hidden sm:block ml-4 text-sm text-muted-foreground truncate">{channel.description}</span>
                        )}
                    </div>
                    <div className="ml-auto flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-foreground h-11 w-11 sm:h-auto sm:w-auto"
                            onClick={(event) => {
                                event.stopPropagation();
                                setIsPinnedOpen(true);
                            }}
                        >
                            <Pin className="h-4 w-4" />
                            <span className="hidden sm:inline ml-1.5">Pinned</span>
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-foreground h-11 w-11 sm:h-auto sm:w-auto"
                            onClick={(event) => {
                                event.stopPropagation();
                                archiveMutation.mutate(!channel.isArchived);
                            }}
                            disabled={archiveMutation.isPending}
                        >
                            <Archive className="h-4 w-4" />
                            <span className="hidden sm:inline ml-1.5">
                                {channel.isArchived ? "Unarchive" : "Archive"}
                            </span>
                        </Button>
                    </div>
                </div>

                {/* Messages List */}
                <div className="flex-1 overflow-hidden p-4">
                    <MessageList
                        messages={messages}
                        virtuosoRef={virtuosoRef}
                        onReply={setActiveThreadId}
                        channelId={channelId}
                        highlightMessageId={highlightMessageId}
                    />
                </div>

                {/* Input Area */}
                <div className="p-2 sm:p-4 border-t border-border/50 bg-white/80 dark:bg-card/80 backdrop-blur-sm">
                    {typingLabel && (
                        <div className="mb-2 text-xs text-primary animate-pulse">{typingLabel}</div>
                    )}
                    <ChatInput
                        placeholder={`Message #${channel.name}`}
                        onSend={handleSend}
                        draftKey={channelId ? `draft:channel:${channelId}` : undefined}
                        onTyping={(isTyping) => {
                            if (!currentUser?.id) return;
                            sendTyping(isTyping, { id: currentUser.id, name: currentUser.name || 'Someone' });
                        }}
                        disabled={sendMutation.isPending}
                    />
                </div>
            </div>

            {/* Thread Panel */}
            {activeThreadId && (
                <ThreadPanel
                    threadId={activeThreadId}
                    channelId={channelId}
                    typingLabel={typingLabelForThread(activeThreadId)}
                    onTyping={(isTyping) => {
                        if (!currentUser?.id) return;
                        sendTyping(isTyping, { id: currentUser.id, name: currentUser.name || 'Someone' }, activeThreadId);
                    }}
                    onClose={() => setActiveThreadId(null)}
                    highlightMessageId={threadHighlightId}
                />
            )}

            <ChannelDetailsDialog
                isOpen={isDetailsOpen}
                onOpenChange={setIsDetailsOpen}
                channel={channel}
                users={users}
                onAddUser={(userId) => addMemberMutation.mutate(userId)}
                isAdding={addMemberMutation.isPending}
                onToggleArchive={() => archiveMutation.mutate(!channel.isArchived)}
                isArchived={channel.isArchived}
                isArchiving={archiveMutation.isPending}
                currentUserId={currentUser?.id}
                currentPreference={currentPreference}
                onUpdateNotificationPreference={(preference) => updateNotificationMutation.mutate(preference)}
                isUpdatingPreference={updateNotificationMutation.isPending}
            />

            {channelId && (
                <PinnedMessagesDialog
                    channelId={channelId}
                    isOpen={isPinnedOpen}
                    onOpenChange={setIsPinnedOpen}
                />
            )}
        </div>
    );
}
