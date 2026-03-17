import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import type { Message, DMMessage } from "@/types/api";

interface WorkUnitDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    sourceMessage?: Message | null;
    sourceDMMessage?: DMMessage | null;
}

export function WorkUnitDialog({
    isOpen,
    onOpenChange,
    sourceMessage,
    sourceDMMessage,
}: WorkUnitDialogProps) {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    // Extract content from source message
    const sourceContent = sourceMessage?.content || sourceDMMessage?.content || "";

    // Generate initial title from content (first line or first 50 chars)
    const generateTitle = (content: string) => {
        const firstLine = content.split('\n')[0];
        if (firstLine.length <= 50) return firstLine;
        return firstLine.substring(0, 47) + '...';
    };

    const [title, setTitle] = useState(generateTitle(sourceContent));
    const [goal, setGoal] = useState(sourceContent);
    const [context, setContext] = useState("");

    const createMutation = useMutation({
        mutationFn: () => api.workUnits.create({
            title,
            goal,
            context: context || undefined,
            sourceMessageId: sourceMessage?.id,
            sourceDMMessageId: sourceDMMessage?.id,
        }),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['work-units'] });
            onOpenChange(false);
            navigate(`/work-units?selected=${data.id}`);
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !goal.trim()) return;
        createMutation.mutate();
    };

    // Reset form when dialog opens with new source
    const handleOpenChange = (open: boolean) => {
        if (open) {
            setTitle(generateTitle(sourceContent));
            setGoal(sourceContent);
            setContext("");
        }
        onOpenChange(open);
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[525px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Create Work Unit</DialogTitle>
                        <DialogDescription>
                            Turn this message into a structured work unit that agents can collaborate on.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="title">Title</Label>
                            <Input
                                id="title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Brief title for the work unit"
                                maxLength={200}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="goal">Goal</Label>
                            <Textarea
                                id="goal"
                                value={goal}
                                onChange={(e) => setGoal(e.target.value)}
                                placeholder="What should be accomplished?"
                                rows={4}
                                maxLength={10000}
                            />
                            <p className="text-xs text-muted-foreground">
                                {goal.length}/10000 characters
                            </p>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="context">Additional Context (Optional)</Label>
                            <Textarea
                                id="context"
                                value={context}
                                onChange={(e) => setContext(e.target.value)}
                                placeholder="Any additional context, constraints, or requirements"
                                rows={3}
                                maxLength={10000}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={!title.trim() || !goal.trim() || createMutation.isPending}
                        >
                            {createMutation.isPending ? "Creating..." : "Create Work Unit"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
