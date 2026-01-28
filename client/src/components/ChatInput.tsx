import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Paperclip, Send, X } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import MentionAutocomplete from "@/components/MentionAutocomplete";
import type { Attachment } from "@/types/api";
import { useToast } from "@/hooks/use-toast";
import { useInputSettings } from "@/hooks/useInputSettings";

interface ChatInputProps {
    placeholder: string;
    onSend: (content: string, attachments: Attachment[]) => void;
    disabled?: boolean;
    onTyping?: (isTyping: boolean) => void;
    draftKey?: string;
}

export default function ChatInput({ placeholder, onSend, disabled, onTyping, draftKey }: ChatInputProps) {
    const [value, setValue] = useState("");
    const [activeIndex, setActiveIndex] = useState(0);
    const [mentionQuery, setMentionQuery] = useState("");
    const [mentionRange, setMentionRange] = useState<{ start: number; end: number } | null>(null);
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastTypingSentAt = useRef(0);
    const { toast } = useToast();
    const { settings } = useInputSettings();

    const { data: users = [] } = useQuery({
        queryKey: ['users'],
        queryFn: () => api.users.list()
    });

    const { data: storageInfo } = useQuery({
        queryKey: ['storage-info'],
        queryFn: () => api.storage.info(),
        staleTime: 300000
    });

    useEffect(() => {
        if (!draftKey) return;
        const stored = localStorage.getItem(draftKey);
        setValue(stored || "");
    }, [draftKey]);

    const filteredUsers = useMemo(() => {
        if (!mentionRange) return [];
        const query = mentionQuery.trim().toLowerCase();
        return users.filter((user: any) => {
            const name = user.name?.toLowerCase() || "";
            const email = user.email?.toLowerCase() || "";
            return name.includes(query) || email.includes(query);
        }).slice(0, 6);
    }, [users, mentionQuery, mentionRange]);

    useEffect(() => {
        return () => {
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
        };
    }, []);

    const updateMentionState = (nextValue: string) => {
        const cursor = inputRef.current?.selectionStart ?? nextValue.length;
        const beforeCursor = nextValue.slice(0, cursor);
        const match = beforeCursor.match(/(^|[\s([{])@([^\s@]{0,50})$/);
        if (match) {
            const atIndex = beforeCursor.lastIndexOf('@');
            setMentionRange({ start: atIndex, end: cursor });
            setMentionQuery(match[2]);
            setActiveIndex(0);
            return;
        }
        setMentionRange(null);
        setMentionQuery("");
    };

    const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        const nextValue = event.target.value;
        setValue(nextValue);
        if (draftKey) {
            localStorage.setItem(draftKey, nextValue);
        }
        updateMentionState(nextValue);
        if (onTyping) {
            const now = Date.now();
            const isTyping = nextValue.trim().length > 0;
            if (!isTyping) {
                onTyping(false);
                if (typingTimeoutRef.current) {
                    clearTimeout(typingTimeoutRef.current);
                    typingTimeoutRef.current = null;
                }
                return;
            }

            if (now - lastTypingSentAt.current > 800) {
                lastTypingSentAt.current = now;
                onTyping(true);
            }

            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
            typingTimeoutRef.current = setTimeout(() => {
                onTyping(false);
            }, 2000);
        }
    };

    const applyMention = (user: any) => {
        if (!mentionRange) return;
        const displayName = user.name || user.email;
        const before = value.slice(0, mentionRange.start);
        const after = value.slice(mentionRange.end);
        const nextValue = `${before}@${displayName} ${after}`;
        setValue(nextValue);
        setMentionRange(null);
        setMentionQuery("");
        requestAnimationFrame(() => {
            const caret = before.length + displayName.length + 2;
            inputRef.current?.setSelectionRange(caret, caret);
            inputRef.current?.focus();
        });
    };

    const submitMessage = () => {
        if (!value.trim() && attachments.length === 0) return;
        onSend(value.trim(), attachments);
        setValue("");
        setAttachments([]);
        if (draftKey) {
            localStorage.removeItem(draftKey);
        }
        setMentionRange(null);
        setMentionQuery("");
        if (onTyping) {
            onTyping(false);
        }
    };

    const insertTextAtCursor = (text: string) => {
        const el = inputRef.current;
        if (!el) return;
        const start = el.selectionStart ?? value.length;
        const end = el.selectionEnd ?? value.length;
        const nextValue = value.slice(0, start) + text + value.slice(end);
        setValue(nextValue);
        if (draftKey) {
            localStorage.setItem(draftKey, nextValue);
        }
        updateMentionState(nextValue);
        requestAnimationFrame(() => {
            const nextCursor = start + text.length;
            el.setSelectionRange(nextCursor, nextCursor);
        });
    };

    const isInCodeBlock = (text: string, cursor: number) => {
        const before = text.slice(0, cursor);
        const matches = before.match(/```/g);
        return (matches?.length || 0) % 2 === 1;
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (mentionRange && filteredUsers.length > 0) {
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActiveIndex((index) => (index + 1) % filteredUsers.length);
                return;
            }
            if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActiveIndex((index) => (index - 1 + filteredUsers.length) % filteredUsers.length);
                return;
            }
            if (event.key === 'Enter') {
                event.preventDefault();
                applyMention(filteredUsers[activeIndex]);
                return;
            }
        }

        if (event.key === 'Enter') {
            const cursor = inputRef.current?.selectionStart ?? value.length;
            const shouldBlockSendInCode =
                settings.enterBehavior === 'send' &&
                settings.codeBlockEnterPrevents &&
                isInCodeBlock(value, cursor);

            if (settings.enterBehavior === 'send') {
                if (event.shiftKey || shouldBlockSendInCode) {
                    event.preventDefault();
                    insertTextAtCursor("\n");
                    return;
                }
                event.preventDefault();
                submitMessage();
                return;
            }

            if (event.metaKey || event.ctrlKey) {
                event.preventDefault();
                submitMessage();
                return;
            }
        }
    };

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files || []);
        if (files.length === 0) return;

        await uploadFiles(files, true);
    };

    const uploadFiles = async (files: File[], resetFileInput = false) => {
        if (files.length === 0) return;
        setIsUploading(true);
        try {
            const uploaded = await Promise.all(files.map((file) => api.upload(file)));
            setAttachments((prev) => [...prev, ...uploaded]);
        } catch (error: any) {
            toast({
                title: "Upload failed",
                description: error?.message || "Unable to upload file.",
                variant: "destructive"
            });
        } finally {
            setIsUploading(false);
            if (resetFileInput && fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    const handlePaste = async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
        if (disabled || isUploading) return;
        const items = Array.from(event.clipboardData?.items || []);
        const imageFiles = items
            .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
            .map((item) => item.getAsFile())
            .filter((file): file is File => Boolean(file));
        if (imageFiles.length === 0) return;
        event.preventDefault();
        await uploadFiles(imageFiles);
    };

    const removeAttachment = (url: string) => {
        setAttachments((prev) => prev.filter((item) => item.url !== url));
    };

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                submitMessage();
            }}
            className="flex gap-2"
        >
            <div className="flex-1 space-y-2">
                {attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {attachments.map((attachment) => (
                            <div key={attachment.url} className="flex items-center gap-2 rounded-lg border border-border/50 bg-white/80 dark:bg-card/80 px-2 py-1 text-xs shadow-sm">
                                <span className="truncate max-w-[180px]">{attachment.filename}</span>
                                <button
                                    type="button"
                                    className="text-muted-foreground hover:text-foreground transition-colors"
                                    onClick={() => removeAttachment(attachment.url)}
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
                {storageInfo && (
                    <div className="text-xs text-muted-foreground">
                        {`${formatBytes(storageInfo.maxUploadSizeBytes)} max file`}
                        {storageInfo.userQuotaBytes > 0 && (
                            ` · You: ${formatBytes(storageInfo.userUsedBytes)} / ${formatBytes(storageInfo.userQuotaBytes)}`
                        )}
                        {storageInfo.orgQuotaBytes > 0 && (
                            ` · Org: ${formatBytes(storageInfo.orgUsedBytes)} / ${formatBytes(storageInfo.orgQuotaBytes)}`
                        )}
                    </div>
                )}

                <div className="relative flex items-center gap-2">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-accent"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={disabled || isUploading}
                        title="Attach file"
                    >
                        <Paperclip className="h-4 w-4" />
                    </Button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        multiple
                        onChange={handleFileSelect}
                    />
                    <div className="relative flex-1">
                        <Textarea
                            ref={inputRef}
                            value={value}
                            onChange={handleChange}
                            onKeyDown={handleKeyDown}
                            onPaste={handlePaste}
                            placeholder={placeholder}
                            rows={1}
                            className="flex-1 resize-none bg-white/60 dark:bg-white/5 border-border/50 focus:border-primary min-h-[44px] max-h-40"
                            disabled={disabled || isUploading}
                            onBlur={() => {
                                onTyping?.(false);
                                if (typingTimeoutRef.current) {
                                    clearTimeout(typingTimeoutRef.current);
                                    typingTimeoutRef.current = null;
                                }
                            }}
                        />
                        {mentionRange && filteredUsers.length > 0 && (
                            <MentionAutocomplete
                                users={filteredUsers}
                                activeIndex={activeIndex}
                                onHighlight={setActiveIndex}
                                onSelect={applyMention}
                            />
                        )}
                    </div>
                </div>
            </div>
            <Button type="submit" disabled={disabled || isUploading} className="shadow-sm">
                <Send className="h-4 w-4" />
            </Button>
        </form>
    );
}

const formatBytes = (bytes: number) => {
    if (!bytes || bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, index);
    return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
};
