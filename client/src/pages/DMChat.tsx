import { useRef, useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useMarkAsRead } from "@/hooks/useMarkAsRead";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Archive, Pin, User as UserIcon } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useChatSocket } from "@/hooks/useChatSocket";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { type VirtuosoHandle } from 'react-virtuoso';
import ThreadPanel from "@/components/ThreadPanel";
import MessageList from "@/components/MessageList";
import ChatInput from "@/components/ChatInput";
import type { Attachment, NotificationPreference } from "@/types/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { resolveAssetUrl } from "@/lib/assets";
import { PinnedMessagesDialog } from "@/components/PinnedMessagesDialog";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

export default function DMChat() {
    const { sessionId } = useParams();
    const [searchParams] = useSearchParams();
    const queryClient = useQueryClient();
    const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isPinnedOpen, setIsPinnedOpen] = useState(false);
    const [highlightMessageId, setHighlightMessageId] = useState<string | null>(null);
    const [threadHighlightId, setThreadHighlightId] = useState<string | null>(null);
    const [searchHandled, setSearchHandled] = useState(false);
    const virtuosoRef = useRef<VirtuosoHandle>(null);
    const { toast } = useToast();
    const { isMobile } = useMediaQuery();

    const { data: sessionData } = authClient.useSession();
    const currentUser = sessionData?.user;

    // Connect to WS
    const { sendTyping, typingLabel, typingLabelForThread } = useChatSocket(undefined, sessionId, currentUser?.id);

    const { data, isLoading, error } = useQuery({
        queryKey: ['dm_messages', sessionId],
        queryFn: () => api.dms.get(sessionId!),
        enabled: !!sessionId
    });

    const messages = data?.messages || [];
    const session = data?.session;

    useMarkAsRead({ sessionId: session?.id, messageCount: messages.length });
    const messageIdParam = searchParams.get("messageId");
    const threadIdParam = searchParams.get("threadId");

    useEffect(() => {
        setSearchHandled(false);
        setHighlightMessageId(null);
        setThreadHighlightId(null);
    }, [sessionId, messageIdParam, threadIdParam]);

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

    const sendMutation = useMutation({
        mutationFn: ({ content, attachments }: { content: string; attachments: Attachment[] }) =>
            api.dms.sendMessage(sessionId!, content, undefined, attachments),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['dm_messages', sessionId] });
            setTimeout(() => {
                virtuosoRef.current?.scrollToIndex({ index: data?.messages?.length || 0, align: 'end' });
            }, 100);
        }
    });

    const handleSend = (messageContent: string, attachments: Attachment[]) => {
        sendMutation.mutate({ content: messageContent, attachments });
    };

    const archiveMutation = useMutation({
        mutationFn: (isArchived: boolean) => api.dms.archive(sessionId!, isArchived),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['dms'] });
            queryClient.invalidateQueries({ queryKey: ['dm_messages', sessionId] });
        }
    });

    const updateNotificationMutation = useMutation({
        mutationFn: (preference: NotificationPreference) =>
            api.dms.updateNotificationPreference(sessionId!, preference),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['dms'] });
            queryClient.invalidateQueries({ queryKey: ['dm_messages', sessionId] });
        }
    });

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
                <div className="text-destructive">Error loading DM</div>
            </div>
        );
    }

    if (!data || !session) return null;

    // Find the other participant
    const otherParticipant = session.participants?.find((p: any) => p.userId !== currentUser?.id)?.user;
    const chatTitle = otherParticipant ? (otherParticipant.name || otherParticipant.email) : "Loading or Unknown User";
    const currentPreference = session.participants?.find((p: any) => p.userId === currentUser?.id)
        ?.notificationPreference ?? "ALL";

    return (
        <div className="flex h-full w-full overflow-hidden">
            {/* Main Chat */}
            <div className={cn(
                "flex-1 flex flex-col min-w-0",
                // Hide main chat on mobile when thread is open
                isMobile && activeThreadId && "hidden"
            )}>
                {/* Header */}
                <div
                    className="h-14 border-b border-border/50 flex items-center px-2 sm:px-4 bg-white/80 dark:bg-card/80 backdrop-blur-sm z-10 flex-shrink-0 cursor-pointer hover:bg-white/90 dark:hover:bg-card/90 transition-colors"
                    onClick={() => otherParticipant && setIsProfileOpen(true)}
                >
                    <div className="flex items-center min-w-0 flex-1">
                        <Avatar className="h-8 w-8 mr-3 ring-2 ring-white/50 dark:ring-white/20 flex-shrink-0">
                            <AvatarImage src={resolveAssetUrl(otherParticipant?.image)} />
                            <AvatarFallback className="bg-gradient-to-br from-loft-mint to-primary text-white">
                                <UserIcon className="h-4 w-4" />
                            </AvatarFallback>
                        </Avatar>
                        <h2 className="font-semibold truncate">{chatTitle}</h2>
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
                                archiveMutation.mutate(!session.isArchived);
                            }}
                            disabled={archiveMutation.isPending}
                        >
                            <Archive className="h-4 w-4" />
                            <span className="hidden sm:inline ml-1.5">
                                {session.isArchived ? "Unarchive" : "Archive"}
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
                        sessionId={sessionId}
                        highlightMessageId={highlightMessageId}
                    />
                </div>

                {/* Input Area */}
                <div className="p-2 sm:p-4 border-t border-border/50 bg-white/80 dark:bg-card/80 backdrop-blur-sm">
                    {typingLabel && (
                        <div className="mb-2 text-xs text-primary animate-pulse">{typingLabel}</div>
                    )}
                    <ChatInput
                        placeholder={`Message ${chatTitle}`}
                        onSend={handleSend}
                        draftKey={sessionId ? `draft:dm:${sessionId}` : undefined}
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
                    sessionId={sessionId}
                    typingLabel={typingLabelForThread(activeThreadId)}
                    onTyping={(isTyping) => {
                        if (!currentUser?.id) return;
                        sendTyping(isTyping, { id: currentUser.id, name: currentUser.name || 'Someone' }, activeThreadId);
                    }}
                    onClose={() => setActiveThreadId(null)}
                    highlightMessageId={threadHighlightId}
                />
            )}

            {/* Profile Dialog */}
            <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Profile</DialogTitle>
                        <DialogDescription className="sr-only">
                            View profile details for this user.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col items-center py-4">
                        <Avatar className="h-24 w-24 mb-4 ring-4 ring-white shadow-cloud-lg">
                            <AvatarImage src={resolveAssetUrl(otherParticipant?.image)} />
                            <AvatarFallback className="text-2xl bg-gradient-to-br from-loft-mint to-primary text-white">
                                {otherParticipant?.name?.[0]}
                            </AvatarFallback>
                        </Avatar>
                        <h2 className="text-xl font-semibold">{otherParticipant?.name}</h2>
                        <p className="text-muted-foreground mb-4">{otherParticipant?.email}</p>

                        <div className="w-full bg-secondary/50 p-4 rounded-xl border border-border/50 text-center">
                            <p className="text-sm font-medium text-muted-foreground mb-1">Bio</p>
                            <p>{otherParticipant?.bio || "No bio set."}</p>
                        </div>

                        <div className="w-full mt-6">
                            <h4 className="text-sm font-semibold mb-2">Notifications</h4>
                            <div className="flex flex-wrap gap-2">
                                {([
                                    { value: "ALL", label: "All activity" },
                                    { value: "MENTIONS", label: "Mentions only" },
                                    { value: "MUTE", label: "Mute" },
                                ] as { value: NotificationPreference; label: string }[]).map((option) => (
                                    <Button
                                        key={option.value}
                                        size="sm"
                                        variant={currentPreference === option.value ? "default" : "outline"}
                                        onClick={() => updateNotificationMutation.mutate(option.value)}
                                        disabled={updateNotificationMutation.isPending}
                                    >
                                        {option.label}
                                    </Button>
                                ))}
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                                Control badge counts and notification noise for this DM.
                            </p>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {sessionId && (
                <PinnedMessagesDialog
                    sessionId={sessionId}
                    isOpen={isPinnedOpen}
                    onOpenChange={setIsPinnedOpen}
                />
            )}
        </div>
    );
}
