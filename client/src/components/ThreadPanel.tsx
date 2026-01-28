import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { api } from "@/lib/api-client";
import { resolveAssetUrl } from "@/lib/assets";
import ChatInput from "@/components/ChatInput";
import MessageContent from "@/components/MessageContent";
import AttachmentList from "@/components/AttachmentList";
import type { Attachment } from "@/types/api";

interface ThreadPanelProps {
    threadId: string;
    channelId?: string;
    sessionId?: string;
    onClose: () => void;
    highlightMessageId?: string | null;
    typingLabel?: string;
    onTyping?: (isTyping: boolean) => void;
}

export default function ThreadPanel({
    threadId,
    channelId,
    sessionId,
    onClose,
    highlightMessageId,
    typingLabel,
    onTyping
}: ThreadPanelProps) {
    const queryClient = useQueryClient();
    const scrollRef = useRef<HTMLDivElement>(null);
    const [highlightedId, setHighlightedId] = useState<string | null>(null);

    const queryKey = channelId ? ['thread', channelId, threadId] : ['dm_thread', sessionId, threadId];
    const parentMessage = useMemo(() => {
        const cacheKey = channelId ? ['messages', channelId] : ['dm_messages', sessionId];
        const cached = queryClient.getQueryData(cacheKey) as any;
        return cached?.messages?.find((message: any) => message.id === threadId) || null;
    }, [channelId, queryClient, sessionId, threadId]);

    const { data, isLoading } = useQuery({
        queryKey,
        queryFn: () => channelId
            ? api.channels.getThread(channelId, threadId)
            : api.dms.getThread(sessionId!, threadId),
        refetchInterval: 3000 // Poll for now, or use socket if we wire it up
        // Note: Socket updates will insert into 'messages' cache, but maybe not specific 'thread' cache
        // We can rely on polling or improve socket logic later to update thread caches too.
    });

    // Parent message finding (from standard cache or fetched data?)
    // The thread API returns { channel/session, messages }.
    // It filters by threadId. 
    // Wait, the parent message itself usually isn't IN the result if filtered by threadId=parent.id?
    // Actually, usually Thread View shows Parent + Replies.
    // If backend only returns replies, we might need to pass the parent message content as prop or fetch it.
    // Let's assume for now backend returns replies.
    // We should probably pass the parent message object as a prop to display at the top.

    const sendMutation = useMutation({
        mutationFn: ({ content, attachments }: { content: string; attachments: Attachment[] }) => channelId
            ? api.channels.sendMessage(channelId, content, threadId, attachments)
            : api.dms.sendMessage(sessionId!, content, threadId, attachments),
        onSuccess: () => {
            // Invalidate thread cache to show new reply
            queryClient.invalidateQueries({ queryKey });
            // Also invalidate parent messages cache to update reply count
            if (channelId) {
                queryClient.invalidateQueries({ queryKey: ['messages', channelId] });
            } else {
                queryClient.invalidateQueries({ queryKey: ['dm_messages', sessionId] });
            }
        }
    });

    const handleSend = (messageContent: string, attachments: Attachment[]) => {
        sendMutation.mutate({ content: messageContent, attachments });
    };

    const getViewport = () =>
        scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLDivElement | null;

    // Auto-scroll to bottom
    useEffect(() => {
        const viewport = getViewport();
        if (viewport) {
            viewport.scrollTop = viewport.scrollHeight;
        }
    }, [data?.messages]);

    useEffect(() => {
        if (!highlightMessageId) return;
        const viewport = getViewport();
        const target = scrollRef.current?.querySelector(
            `[data-message-id="${highlightMessageId}"]`
        ) as HTMLElement | null;
        if (!target || !viewport) return;

        setHighlightedId(highlightMessageId);
        const timeout = setTimeout(() => {
            setHighlightedId((current) => (current === highlightMessageId ? null : current));
        }, 2500);

        target.scrollIntoView({ block: "center" });

        return () => clearTimeout(timeout);
    }, [highlightMessageId, data?.messages]);

    const messages = data?.messages || [];
    const { isMobile } = useMediaQuery();

    // Panel content (same for both mobile and desktop)
    const panelContent = (
        <div className="flex flex-col h-full shadow-xl z-20">
            {/* Header */}
            <div className="h-14 border-b bg-white dark:bg-card flex items-center justify-between px-4 flex-shrink-0">
                <h3 className="font-bold text-sm">Thread</h3>
                <Button variant="ghost" size="icon" onClick={onClose}>
                    <X className="h-4 w-4" />
                </Button>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                <div className="space-y-4">
                    {parentMessage && (
                        <div className="rounded-lg border border-gray-200 bg-white p-3">
                            <div className="flex items-start gap-2">
                                <Avatar className="h-7 w-7 mt-0.5">
                                    <AvatarImage src={resolveAssetUrl(parentMessage.sender?.image)} />
                                    <AvatarFallback className="text-[10px]">{parentMessage.sender?.name?.[0]}</AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                                        <span className="font-semibold text-gray-800">
                                            {parentMessage.sender?.name || parentMessage.sender?.email}
                                        </span>
                                        <span>Original message</span>
                                    </div>
                                    <MessageContent
                                        content={parentMessage.content}
                                        mentions={parentMessage.mentions}
                                        className="text-sm text-gray-800"
                                    />
                                    <AttachmentList attachments={parentMessage.attachments} />
                                </div>
                            </div>
                        </div>
                    )}

                    {isLoading && <div className="text-center text-gray-500 text-sm">Loading replies...</div>}

                    {messages.length === 0 && !isLoading && (
                        <div className="text-center text-gray-500 text-sm mt-10">No replies yet.</div>
                    )}

                    {messages.map((msg: any) => (
                        <div
                            key={msg.id}
                            data-message-id={msg.id}
                            className={`flex flex-col rounded-md px-2 py-1 ${msg.id === highlightedId ? "bg-amber-50 ring-1 ring-amber-200" : ""}`}
                        >
                            <div className="flex items-start group">
                                <Avatar className="h-8 w-8 mr-2 mt-1">
                                    <AvatarImage src={resolveAssetUrl(msg.sender?.image)} />
                                    <AvatarFallback>{msg.sender?.name?.[0]}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <div className="flex items-center">
                                        <span className="font-bold text-sm mr-2">{msg.sender?.name}</span>
                                        <span className="text-xs text-gray-400">
                                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <MessageContent
                                        content={msg.content}
                                        mentions={msg.mentions}
                                        className="text-sm text-gray-800"
                                    />
                                    <AttachmentList attachments={msg.attachments} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-4 bg-white dark:bg-card border-t">
                {typingLabel && (
                    <div className="mb-2 text-xs text-gray-500">{typingLabel}</div>
                )}
                <ChatInput
                    placeholder="Reply..."
                    onSend={handleSend}
                    onTyping={onTyping}
                    disabled={sendMutation.isPending}
                />
            </div>
        </div>
    );

    // Mobile: Fullscreen Sheet
    if (isMobile) {
        return (
            <Sheet open={true} onOpenChange={onClose}>
                <SheetContent side="right" className="w-full p-0 sm:max-w-full bg-gray-50 dark:bg-background">
                    {panelContent}
                </SheetContent>
            </Sheet>
        );
    }

    // Desktop: Side panel
    return (
        <div className="w-[350px] border-l border-gray-200 dark:border-border bg-gray-50 dark:bg-background">
            {panelContent}
        </div>
    );
}
