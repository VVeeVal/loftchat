import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import {
    Briefcase,
    Clock,
    CheckCircle2,
    PlayCircle,
    AlertCircle,
    XCircle,
    FileText,
    Bot,
    MessageSquare,
    FileOutput,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api-client";
import { WorkUnitPanel } from "@/components/WorkUnitPanel";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import type { WorkUnit, WorkUnitStatus } from "@/types/api";

const statusConfig: Record<WorkUnitStatus, { label: string; icon: React.ReactNode; color: string }> = {
    DRAFT: { label: 'Draft', icon: <FileText className="h-4 w-4" />, color: 'bg-gray-500' },
    OPEN: { label: 'Open', icon: <AlertCircle className="h-4 w-4" />, color: 'bg-blue-500' },
    IN_PROGRESS: { label: 'In Progress', icon: <PlayCircle className="h-4 w-4" />, color: 'bg-yellow-500' },
    REVIEW: { label: 'Review', icon: <Clock className="h-4 w-4" />, color: 'bg-purple-500' },
    COMPLETED: { label: 'Completed', icon: <CheckCircle2 className="h-4 w-4" />, color: 'bg-green-500' },
    CANCELLED: { label: 'Cancelled', icon: <XCircle className="h-4 w-4" />, color: 'bg-red-500' },
};

const statusFilters: { value: WorkUnitStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'OPEN', label: 'Open' },
    { value: 'IN_PROGRESS', label: 'In Progress' },
    { value: 'REVIEW', label: 'Review' },
    { value: 'COMPLETED', label: 'Completed' },
];

export default function WorkUnits() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [statusFilter, setStatusFilter] = useState<WorkUnitStatus | 'all'>('all');
    const [selectedId, setSelectedId] = useState<string | null>(null);

    // Get selected ID from URL on mount
    useEffect(() => {
        const urlSelected = searchParams.get('selected');
        if (urlSelected) {
            setSelectedId(urlSelected);
        }
    }, [searchParams]);

    const { data: workUnits = [], isLoading } = useQuery({
        queryKey: ['work-units', statusFilter],
        queryFn: () => api.workUnits.list(statusFilter === 'all' ? undefined : { status: statusFilter }),
        refetchInterval: 5000,
    });

    const handleSelect = (id: string) => {
        setSelectedId(id);
        setSearchParams({ selected: id });
    };

    const handleClose = () => {
        setSelectedId(null);
        setSearchParams({});
    };

    return (
        <RouteErrorBoundary
            title="Work units failed to render"
            description="One of the work unit views crashed while opening. Close the current selection and try again."
            resetKey={selectedId}
            onReset={handleClose}
        >
        <div className="flex h-full">
            {/* Main List */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <div className="p-4 border-b">
                    <div className="flex items-center gap-2 mb-4">
                        <Briefcase className="h-5 w-5" />
                        <h1 className="text-xl font-semibold">Work Units</h1>
                    </div>

                    {/* Status Filters */}
                    <div className="flex gap-2 flex-wrap">
                        {statusFilters.map(({ value, label }) => (
                            <Button
                                key={value}
                                variant={statusFilter === value ? "default" : "outline"}
                                size="sm"
                                onClick={() => setStatusFilter(value)}
                            >
                                {label}
                            </Button>
                        ))}
                    </div>
                </div>

                {/* Work Units List */}
                <div className="flex-1 overflow-auto p-4">
                    {isLoading ? (
                        <p className="text-center text-muted-foreground">Loading...</p>
                    ) : workUnits.length === 0 ? (
                        <div className="text-center py-12">
                            <Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                            <h3 className="text-lg font-medium mb-2">No work units yet</h3>
                            <p className="text-muted-foreground">
                                Turn any message into a work unit by clicking the briefcase icon.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {workUnits.map((workUnit: WorkUnit) => {
                                const status = statusConfig[workUnit.status];
                                const isSelected = selectedId === workUnit.id;

                                return (
                                    <button
                                        key={workUnit.id}
                                        onClick={() => handleSelect(workUnit.id)}
                                        className={`w-full text-left p-4 rounded-lg border transition-colors ${
                                            isSelected
                                                ? 'border-primary bg-primary/5'
                                                : 'hover:bg-muted/50'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="font-medium truncate">{workUnit.title}</h3>
                                                    <Badge variant="outline" className={`${status.color} text-white shrink-0`}>
                                                        {status.icon}
                                                        <span className="ml-1">{status.label}</span>
                                                    </Badge>
                                                </div>
                                                <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                                                    {workUnit.goal}
                                                </p>
                                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                    <div className="flex items-center gap-1">
                                                        <Avatar className="h-4 w-4">
                                                            <AvatarImage src={workUnit.owner.image || undefined} />
                                                            <AvatarFallback className="text-[8px]">
                                                                {workUnit.owner.name?.[0] || workUnit.owner.email[0]}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <span>{workUnit.owner.name || workUnit.owner.email}</span>
                                                    </div>
                                                    <span>
                                                        {formatDistanceToNow(new Date(workUnit.updatedAt), { addSuffix: true })}
                                                    </span>
                                                    {workUnit._count && (
                                                        <>
                                                            <div className="flex items-center gap-1">
                                                                <MessageSquare className="h-3 w-3" />
                                                                <span>{workUnit._count.messages}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <FileOutput className="h-3 w-3" />
                                                                <span>{workUnit._count.outputs}</span>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Assigned Agents */}
                                            {workUnit.assignedAgents && workUnit.assignedAgents.length > 0 && (
                                                <div className="flex -space-x-2">
                                                    {workUnit.assignedAgents.slice(0, 3).map((agent) => (
                                                        <Avatar key={agent.id} className="h-6 w-6 border-2 border-background">
                                                            <AvatarImage src={agent.botUser.app?.iconUrl || undefined} />
                                                            <AvatarFallback>
                                                                <Bot className="h-3 w-3" />
                                                            </AvatarFallback>
                                                        </Avatar>
                                                    ))}
                                                    {workUnit.assignedAgents.length > 3 && (
                                                        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs border-2 border-background">
                                                            +{workUnit.assignedAgents.length - 3}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Side Panel */}
            {selectedId && (
                <WorkUnitPanel
                    workUnitId={selectedId}
                    onClose={handleClose}
                />
            )}
        </div>
        </RouteErrorBoundary>
    );
}
