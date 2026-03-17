import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
    X,
    MessageSquare,
    FileOutput,
    Settings,
    Send,
    Clock,
    CheckCircle2,
    PlayCircle,
    AlertCircle,
    XCircle,
    FileText,
    Bot,
    User as UserIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { APIError, api } from "@/lib/api-client";
import { AgentSelector } from "./AgentSelector";
import type { WorkUnitStatus, User } from "@/types/api";
import { authClient } from "@/lib/auth-client";

interface WorkUnitPanelProps {
    workUnitId: string;
    onClose: () => void;
}

const statusConfig: Record<WorkUnitStatus, { label: string; icon: React.ReactNode; color: string }> = {
    DRAFT: { label: 'Draft', icon: <FileText className="h-4 w-4" />, color: 'bg-gray-500' },
    OPEN: { label: 'Open', icon: <AlertCircle className="h-4 w-4" />, color: 'bg-blue-500' },
    IN_PROGRESS: { label: 'In Progress', icon: <PlayCircle className="h-4 w-4" />, color: 'bg-yellow-500' },
    REVIEW: { label: 'Review', icon: <Clock className="h-4 w-4" />, color: 'bg-purple-500' },
    COMPLETED: { label: 'Completed', icon: <CheckCircle2 className="h-4 w-4" />, color: 'bg-green-500' },
    CANCELLED: { label: 'Cancelled', icon: <XCircle className="h-4 w-4" />, color: 'bg-red-500' },
};

function getUserLabel(user?: { name?: string | null; email?: string | null } | null) {
    return user?.name || user?.email || "Unknown user";
}

function getUserInitial(user?: { name?: string | null; email?: string | null } | null) {
    return getUserLabel(user).trim().charAt(0).toUpperCase() || "?";
}

function formatRelativeTime(value?: string | null) {
    if (!value) return "Unknown time";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "Unknown time";
    }

    return formatDistanceToNow(date, { addSuffix: true });
}

export function WorkUnitPanel({ workUnitId, onClose }: WorkUnitPanelProps) {
    const queryClient = useQueryClient();
    const [messageInput, setMessageInput] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const { data: sessionData } = authClient.useSession();
    const currentUserId = sessionData?.user?.id;

    const { data: workUnit, isLoading, error: workUnitError } = useQuery({
        queryKey: ['work-unit', workUnitId],
        queryFn: () => api.workUnits.get(workUnitId),
        refetchInterval: 5000,
    });

    const { data: messages = [] } = useQuery({
        queryKey: ['work-unit-messages', workUnitId],
        queryFn: () => api.workUnits.getMessages(workUnitId),
        refetchInterval: 3000,
    });

    const { data: outputs = [] } = useQuery({
        queryKey: ['work-unit-outputs', workUnitId],
        queryFn: () => api.workUnits.getOutputs(workUnitId),
        refetchInterval: 5000,
    });

    const { data: users = [] } = useQuery({
        queryKey: ['users'],
        queryFn: () => api.users.list(),
    });

    const sendMessageMutation = useMutation({
        mutationFn: (content: string) => api.workUnits.sendMessage(workUnitId, content),
        onSuccess: () => {
            setMessageInput("");
            queryClient.invalidateQueries({ queryKey: ['work-unit-messages', workUnitId] });
        },
    });

    const updateStatusMutation = useMutation({
        mutationFn: (status: WorkUnitStatus) => api.workUnits.updateStatus(workUnitId, status),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['work-unit', workUnitId] });
            queryClient.invalidateQueries({ queryKey: ['work-units'] });
        },
    });

    const addReviewerMutation = useMutation({
        mutationFn: (userId: string) => api.workUnits.addReviewer(workUnitId, userId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['work-unit', workUnitId] });
        },
    });

    const removeReviewerMutation = useMutation({
        mutationFn: (userId: string) => api.workUnits.removeReviewer(workUnitId, userId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['work-unit', workUnitId] });
        },
    });

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!messageInput.trim()) return;
        sendMessageMutation.mutate(messageInput.trim());
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage(e);
        }
    };

    if (isLoading) {
        return (
            <div className="w-96 border-l flex items-center justify-center">
                <p className="text-muted-foreground">Loading...</p>
            </div>
        );
    }

    if (workUnitError || !workUnit) {
        const errorMessage = workUnitError instanceof APIError
            ? workUnitError.message
            : "This work unit could not be loaded.";

        return (
            <div className="w-96 border-l flex items-center justify-center bg-background p-6">
                <div className="space-y-3 text-center">
                    <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
                    <div>
                        <p className="font-medium">Unable to open work unit</p>
                        <p className="text-sm text-muted-foreground">{errorMessage}</p>
                    </div>
                    <Button variant="outline" onClick={onClose}>
                        Close
                    </Button>
                </div>
            </div>
        );
    }

    const isOwner = workUnit.ownerId === currentUserId;
    const isReviewer = workUnit.reviewers?.some(r => r.userId === currentUserId);
    const canChangeStatus = isOwner || isReviewer;
    const statusInfo = statusConfig[workUnit.status];

    const reviewerUserIds = new Set(workUnit.reviewers?.map(r => r.userId) || []);
    const availableReviewers = users.filter(
        (u: User) => u.id !== workUnit.ownerId && !reviewerUserIds.has(u.id)
    );

    return (
        <div className="w-96 border-l flex flex-col h-full bg-background">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
                <div className="flex-1 min-w-0">
                    <h2 className="font-semibold truncate">{workUnit.title}</h2>
                    <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className={`${statusInfo.color} text-white`}>
                            {statusInfo.icon}
                            <span className="ml-1">{statusInfo.label}</span>
                        </Badge>
                    </div>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose}>
                    <X className="h-4 w-4" />
                </Button>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="discussion" className="flex-1 flex flex-col min-h-0">
                <TabsList className="w-full justify-start rounded-none border-b px-4">
                    <TabsTrigger value="discussion" className="gap-1">
                        <MessageSquare className="h-4 w-4" />
                        Discussion
                    </TabsTrigger>
                    <TabsTrigger value="outputs" className="gap-1">
                        <FileOutput className="h-4 w-4" />
                        Outputs
                    </TabsTrigger>
                    <TabsTrigger value="settings" className="gap-1">
                        <Settings className="h-4 w-4" />
                        Settings
                    </TabsTrigger>
                </TabsList>

                {/* Discussion Tab */}
                <TabsContent value="discussion" className="flex-1 flex flex-col min-h-0 m-0">
                    {/* Goal */}
                    <div className="p-4 border-b bg-muted/50">
                        <h4 className="text-xs font-medium text-muted-foreground mb-1">Goal</h4>
                        <p className="text-sm whitespace-pre-wrap">{workUnit.goal}</p>
                        {workUnit.context && (
                            <>
                                <h4 className="text-xs font-medium text-muted-foreground mb-1 mt-3">Context</h4>
                                <p className="text-sm whitespace-pre-wrap text-muted-foreground">{workUnit.context}</p>
                            </>
                        )}
                    </div>

                    {/* Messages */}
                    <ScrollArea className="flex-1">
                        <div className="p-4 space-y-4">
                            {messages.length === 0 ? (
                                <p className="text-center text-muted-foreground text-sm">
                                    No messages yet. Start the discussion!
                                </p>
                            ) : (
                                messages.map((message) => (
                                    <div key={message.id} className="flex gap-3">
                                            <Avatar className="h-8 w-8">
                                                <AvatarImage src={message.sender.image || undefined} />
                                                <AvatarFallback>
                                                    {getUserInitial(message.sender)}
                                                </AvatarFallback>
                                            </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-baseline gap-2">
                                                <span className="font-medium text-sm">{getUserLabel(message.sender)}</span>
                                                <span className="text-xs text-muted-foreground">
                                                    {formatRelativeTime(message.createdAt)}
                                                </span>
                                            </div>
                                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                    </ScrollArea>

                    {/* Message Input */}
                    <form onSubmit={handleSendMessage} className="p-4 border-t">
                        <div className="flex gap-2">
                            <Textarea
                                value={messageInput}
                                onChange={(e) => setMessageInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Type a message..."
                                rows={1}
                                className="min-h-[40px] max-h-[120px] resize-none"
                            />
                            <Button
                                type="submit"
                                size="icon"
                                disabled={!messageInput.trim() || sendMessageMutation.isPending}
                            >
                                <Send className="h-4 w-4" />
                            </Button>
                        </div>
                    </form>
                </TabsContent>

                {/* Outputs Tab */}
                <TabsContent value="outputs" className="flex-1 m-0">
                    <ScrollArea className="h-full">
                        <div className="p-4 space-y-4">
                            {outputs.length === 0 ? (
                                <p className="text-center text-muted-foreground text-sm">
                                    No outputs yet. Agents will submit their work here.
                                </p>
                            ) : (
                                outputs.map((output) => (
                                    <div key={output.id} className="border rounded-lg p-3">
                                        <div className="flex items-center gap-2 mb-2">
                                            {output.botUser ? (
                                                <>
                                                    <Avatar className="h-6 w-6">
                                                        <AvatarImage src={output.botUser.app?.iconUrl || undefined} />
                                                        <AvatarFallback>
                                                            <Bot className="h-3 w-3" />
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <span className="text-sm font-medium">{output.botUser.app?.name}</span>
                                                </>
                                            ) : output.user ? (
                                                <>
                                                    <Avatar className="h-6 w-6">
                                                        <AvatarImage src={output.user.image || undefined} />
                                                        <AvatarFallback>
                                                            <UserIcon className="h-3 w-3" />
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <span className="text-sm font-medium">{getUserLabel(output.user)}</span>
                                                </>
                                            ) : null}
                                            <Badge variant="outline" className="ml-auto">{output.type}</Badge>
                                        </div>
                                        <h4 className="font-medium">{output.name}</h4>
                                        <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap line-clamp-3">
                                            {output.content}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-2">
                                            {formatRelativeTime(output.createdAt)}
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>
                    </ScrollArea>
                </TabsContent>

                {/* Settings Tab */}
                <TabsContent value="settings" className="flex-1 m-0">
                    <ScrollArea className="h-full">
                        <div className="p-4 space-y-6">
                            {/* Status */}
                            <div>
                                <h4 className="text-sm font-medium mb-3">Status</h4>
                                <div className="flex flex-wrap gap-2">
                                    {(Object.keys(statusConfig) as WorkUnitStatus[]).map((status) => {
                                        const config = statusConfig[status];
                                        const isActive = workUnit.status === status;
                                        return (
                                            <Button
                                                key={status}
                                                variant={isActive ? "default" : "outline"}
                                                size="sm"
                                                disabled={!canChangeStatus || updateStatusMutation.isPending}
                                                onClick={() => updateStatusMutation.mutate(status)}
                                                className={isActive ? config.color : ''}
                                            >
                                                {config.icon}
                                                <span className="ml-1">{config.label}</span>
                                            </Button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Agents */}
                            <AgentSelector
                                workUnitId={workUnitId}
                                assignedAgents={workUnit.assignedAgents || []}
                                isOwner={isOwner}
                            />

                            {/* Reviewers */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-medium">Reviewers</h4>
                                </div>
                                {workUnit.reviewers && workUnit.reviewers.length > 0 ? (
                                    <div className="space-y-2">
                                        {workUnit.reviewers.map((reviewer) => (
                                            <div key={reviewer.id} className="flex items-center gap-2">
                                                <Avatar className="h-6 w-6">
                                                    <AvatarImage src={reviewer.user.image || undefined} />
                                                    <AvatarFallback>
                                                        {getUserInitial(reviewer.user)}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <span className="text-sm flex-1">{getUserLabel(reviewer.user)}</span>
                                                {isOwner && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => removeReviewerMutation.mutate(reviewer.userId)}
                                                        disabled={removeReviewerMutation.isPending}
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </Button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">No reviewers assigned</p>
                                )}
                                {isOwner && availableReviewers.length > 0 && (
                                    <select
                                        className="w-full p-2 border rounded text-sm"
                                        onChange={(e) => {
                                            if (e.target.value) {
                                                addReviewerMutation.mutate(e.target.value);
                                                e.target.value = '';
                                            }
                                        }}
                                        disabled={addReviewerMutation.isPending}
                                    >
                                        <option value="">Add reviewer...</option>
                                        {availableReviewers.map((user: User) => (
                                            <option key={user.id} value={user.id}>
                                                {user.name || user.email}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            {/* Owner */}
                            <div>
                                <h4 className="text-sm font-medium mb-2">Owner</h4>
                                <div className="flex items-center gap-2">
                                    <Avatar className="h-6 w-6">
                                        <AvatarImage src={workUnit.owner.image || undefined} />
                                        <AvatarFallback>
                                            {getUserInitial(workUnit.owner)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <span className="text-sm">{getUserLabel(workUnit.owner)}</span>
                                </div>
                            </div>

                            {/* Metadata */}
                            <div className="text-xs text-muted-foreground space-y-1">
                                <p>Created {formatRelativeTime(workUnit.createdAt)}</p>
                                <p>Updated {formatRelativeTime(workUnit.updatedAt)}</p>
                                {workUnit.completedAt && (
                                    <p>Completed {formatRelativeTime(workUnit.completedAt)}</p>
                                )}
                            </div>
                        </div>
                    </ScrollArea>
                </TabsContent>
            </Tabs>
        </div>
    );
}
