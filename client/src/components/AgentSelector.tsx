import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Plus, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api-client";
import type { BotUser, WorkUnitAgent } from "@/types/api";

interface AgentSelectorProps {
    workUnitId: string;
    assignedAgents: WorkUnitAgent[];
    isOwner: boolean;
}

export function AgentSelector({ workUnitId, assignedAgents, isOwner }: AgentSelectorProps) {
    const queryClient = useQueryClient();

    const { data: availableAgents = [] } = useQuery({
        queryKey: ['available-agents'],
        queryFn: () => api.workUnits.availableAgents(),
    });

    const assignMutation = useMutation({
        mutationFn: (botUserId: string) => api.workUnits.assignAgent(workUnitId, botUserId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['work-unit', workUnitId] });
            queryClient.invalidateQueries({ queryKey: ['work-units'] });
        },
    });

    const removeMutation = useMutation({
        mutationFn: (botUserId: string) => api.workUnits.removeAgent(workUnitId, botUserId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['work-unit', workUnitId] });
            queryClient.invalidateQueries({ queryKey: ['work-units'] });
        },
    });

    const assignedBotUserIds = new Set(assignedAgents.map(a => a.botUserId));
    const unassignedAgents = availableAgents.filter(
        (agent: BotUser) => !assignedBotUserIds.has(agent.id)
    );

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Assigned Agents</h4>
                {isOwner && unassignedAgents.length > 0 && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 px-2">
                                <Plus className="h-4 w-4 mr-1" />
                                Add
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-64 p-2" align="end">
                            <div className="space-y-1">
                                {unassignedAgents.map((agent: BotUser) => (
                                    <DropdownMenuItem
                                        key={agent.id}
                                        onClick={() => assignMutation.mutate(agent.id)}
                                        disabled={assignMutation.isPending}
                                        className="flex items-center gap-2 p-2"
                                    >
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={agent.app?.iconUrl || undefined} />
                                            <AvatarFallback>
                                                <Bot className="h-4 w-4" />
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{agent.name}</p>
                                            <p className="text-xs text-muted-foreground truncate">
                                                {agent.app?.name}
                                            </p>
                                        </div>
                                    </DropdownMenuItem>
                                ))}
                            </div>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>

            {assignedAgents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No agents assigned</p>
            ) : (
                <div className="flex flex-wrap gap-2">
                    {assignedAgents.map((assignment) => (
                        <div
                            key={assignment.id}
                            className="flex items-center gap-2 bg-muted rounded-full pl-1 pr-2 py-1"
                        >
                            <Avatar className="h-6 w-6">
                                <AvatarImage src={assignment.botUser.app?.iconUrl || undefined} />
                                <AvatarFallback>
                                    <Bot className="h-3 w-3" />
                                </AvatarFallback>
                            </Avatar>
                            <span className="text-sm">{assignment.botUser.name}</span>
                            {isOwner && (
                                <button
                                    onClick={() => removeMutation.mutate(assignment.botUserId)}
                                    disabled={removeMutation.isPending}
                                    className="text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
