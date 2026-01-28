import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Hash, MessageSquare, Search, User as UserIcon } from "lucide-react";
import { api } from "@/lib/api-client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Channel, SearchMessageResult, SearchResults, User } from "@/types/api";
import { resolveAssetUrl } from "@/lib/assets";

const truncate = (text: string, max = 140) => {
    if (text.length <= max) return text;
    return `${text.slice(0, max - 3)}...`;
};

const emptyResults: SearchResults = {
    query: "",
    channels: [],
    users: [],
    messages: []
};

interface SearchDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    currentUserId?: string;
}

export default function SearchDialog({ isOpen, onOpenChange, currentUserId }: SearchDialogProps) {
    const [query, setQuery] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");
    const [type, setType] = useState<"all" | "channels" | "users" | "messages">("all");
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            const timeout = setTimeout(() => inputRef.current?.focus(), 100);
            return () => clearTimeout(timeout);
        }
        return;
    }, [isOpen]);

    useEffect(() => {
        const timeout = setTimeout(() => {
            setDebouncedQuery(query.trim());
        }, 250);
        return () => clearTimeout(timeout);
    }, [query]);

    const { data, isLoading } = useQuery({
        queryKey: ["search", debouncedQuery, type],
        queryFn: () => api.search(debouncedQuery, type),
        enabled: isOpen && debouncedQuery.length >= 2
    });

    const results = data ?? emptyResults;
    const showChannels = type === "all" || type === "channels";
    const showUsers = type === "all" || type === "users";
    const showMessages = type === "all" || type === "messages";

    const isEmpty =
        debouncedQuery.length >= 2 &&
        !isLoading &&
        results.channels.length === 0 &&
        results.users.length === 0 &&
        results.messages.length === 0;

    const messageResults = useMemo(() => {
        return results.messages;
    }, [results.messages]);

    const getDmLabel = (message: SearchMessageResult) => {
        if (!message.session?.participants) return "Direct Message";
        const participants = message.session.participants as Array<{ userId: string; user?: User }>;
        const other = participants.find((participant) => participant.userId !== currentUserId)?.user;
        return other?.name || other?.email || "Direct Message";
    };

    const renderChannelItem = (channel: Channel) => (
        <Link
            key={channel.id}
            to={`/channels/${channel.id}`}
            onClick={() => onOpenChange(false)}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-900 hover:bg-gray-100"
        >
            <Hash className="h-4 w-4 text-gray-500" />
            <div className="min-w-0">
                <div className="font-medium text-gray-900 truncate">{channel.name}</div>
                {channel.description && (
                    <div className="text-xs text-gray-500 truncate">{channel.description}</div>
                )}
            </div>
        </Link>
    );

    const renderUserItem = (user: User) => (
        <div
            key={user.id}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-900"
        >
            <Avatar className="h-7 w-7 rounded-sm">
                <AvatarImage src={resolveAssetUrl(user.image)} />
                <AvatarFallback className="rounded-sm">
                    <UserIcon className="h-3 w-3" />
                </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
                <div className="font-medium truncate">{user.name || user.email}</div>
                {user.name && (
                    <div className="text-xs text-gray-500 truncate">{user.email}</div>
                )}
            </div>
        </div>
    );

    const renderMessageItem = (message: SearchMessageResult) => {
        const basePath = message.type === "channel"
            ? `/channels/${message.channel?.id}`
            : `/dms/${message.session?.id}`;
        const params = new URLSearchParams();
        params.set("messageId", message.id);
        if (message.threadId) params.set("threadId", message.threadId);
        const href = basePath && params.toString()
            ? `${basePath}?${params.toString()}`
            : basePath || "#";
        const location = message.type === "channel"
            ? `#${message.channel?.name || "channel"}`
            : getDmLabel(message);

        return (
            <Link
                key={message.id}
                to={href}
                onClick={() => onOpenChange(false)}
                className="flex items-start gap-3 rounded-md px-3 py-2 text-sm text-gray-900 hover:bg-gray-100"
            >
                <div className="mt-0.5">
                    {message.type === "channel" ? (
                        <Hash className="h-4 w-4 text-gray-500" />
                    ) : (
                        <MessageSquare className="h-4 w-4 text-gray-500" />
                    )}
                </div>
                <div className="min-w-0">
                    <div className="text-xs text-gray-500">
                        {message.sender?.name || message.sender?.email || "Someone"} in {location}
                    </div>
                    <div className="text-sm text-gray-900 truncate">
                        {truncate(message.content)}
                    </div>
                </div>
                <div className="ml-auto text-xs text-gray-400">
                    {message.createdAt ? new Date(message.createdAt).toLocaleDateString() : ""}
                </div>
            </Link>
        );
    };

    const renderSection = (label: string, items: ReactNode[]) => (
        <div className="space-y-2">
            <div className="px-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                {label}
            </div>
            <div className="space-y-1">{items}</div>
        </div>
    );

    const renderResultsContent = () => (
        <>
            {debouncedQuery.length < 2 && (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-gray-500">
                    Type at least 2 characters to search.
                </div>
            )}
            {isLoading && debouncedQuery.length >= 2 && (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-gray-500">
                    Searching...
                </div>
            )}
            {isEmpty && (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-gray-500">
                    No results found for "{debouncedQuery}".
                </div>
            )}
            {!isLoading && debouncedQuery.length >= 2 && !isEmpty && (
                <div className="space-y-5">
                    {showChannels && results.channels.length > 0 &&
                        renderSection("Channels", results.channels.map(renderChannelItem))}
                    {showUsers && results.users.length > 0 &&
                        renderSection("People", results.users.map(renderUserItem))}
                    {showMessages && messageResults.length > 0 &&
                        renderSection("Messages", messageResults.map(renderMessageItem))}
                </div>
            )}
        </>
    );

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-[720px] max-h-[85vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle>Search</DialogTitle>
                    <DialogDescription className="sr-only">
                        Search messages, channels, and people in this workspace.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
                    <div className="relative flex-shrink-0">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <Input
                            ref={inputRef}
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Search messages, channels, or people"
                            className="pl-9"
                        />
                    </div>

                    <Tabs value={type} onValueChange={(value) => setType(value as typeof type)} className="flex-1 flex flex-col overflow-hidden">
                        <TabsList className="w-full justify-start overflow-x-auto flex-shrink-0">
                            <TabsTrigger value="all">All</TabsTrigger>
                            <TabsTrigger value="channels">Channels</TabsTrigger>
                            <TabsTrigger value="users">People</TabsTrigger>
                            <TabsTrigger value="messages">Messages</TabsTrigger>
                        </TabsList>

                        <div className="flex-1 overflow-y-auto">
                            <TabsContent value="all">{renderResultsContent()}</TabsContent>
                            <TabsContent value="channels">{renderResultsContent()}</TabsContent>
                            <TabsContent value="users">{renderResultsContent()}</TabsContent>
                            <TabsContent value="messages">{renderResultsContent()}</TabsContent>
                        </div>
                    </Tabs>
                </div>
            </DialogContent>
        </Dialog>
    );
}
