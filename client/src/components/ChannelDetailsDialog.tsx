import { useEffect, useMemo, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User as UserIcon } from "lucide-react";
import type { NotificationPreference } from "@/types/api";
import { PresenceIndicator } from "./PresenceIndicator";
import { resolveAssetUrl } from "@/lib/assets";

interface ChannelDetailsDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    channel: any;
    users: any[];
    onAddUser: (userId: string) => void;
    isAdding?: boolean;
    onToggleArchive?: () => void;
    isArchived?: boolean;
    isArchiving?: boolean;
    currentUserId?: string;
    currentPreference?: NotificationPreference;
    onUpdateNotificationPreference?: (preference: NotificationPreference) => void;
    isUpdatingPreference?: boolean;
}

export function ChannelDetailsDialog({
    isOpen,
    onOpenChange,
    channel,
    users,
    onAddUser,
    isAdding = false,
    onToggleArchive,
    isArchived,
    isArchiving = false,
    currentUserId,
    currentPreference,
    onUpdateNotificationPreference,
    isUpdatingPreference = false,
}: ChannelDetailsDialogProps) {
    const [search, setSearch] = useState("");

    useEffect(() => {
        if (isOpen) setSearch("");
    }, [isOpen]);

    const members = channel?.members || [];
    const resolvedPreference = useMemo(() => {
        if (currentPreference) return currentPreference;
        if (currentUserId) {
            const member = members.find((member: any) => member.userId === currentUserId);
            return member?.notificationPreference || "ALL";
        }
        return "ALL";
    }, [currentPreference, currentUserId, members]);

    const availableUsers = useMemo(() => {
        const memberIds = new Set(members.map((member: any) => member.userId));
        return (users || []).filter((user: any) => !memberIds.has(user.id));
    }, [members, users]);

    const filteredUsers = useMemo(() => {
        const query = search.toLowerCase();
        return availableUsers.filter((user: any) =>
            user.name?.toLowerCase().includes(query) ||
            user.email?.toLowerCase().includes(query)
        );
    }, [availableUsers, search]);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Channel Details</DialogTitle>
                    <DialogDescription className="sr-only">
                        View channel information and manage members.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-6 py-2">
                    <div>
                        <h3 className="text-lg font-semibold"># {channel?.name}</h3>
                        <p className="text-sm text-gray-500">
                            {channel?.description || "No description set."}
                        </p>
                        {onToggleArchive && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="mt-3"
                                onClick={onToggleArchive}
                                disabled={isArchiving}
                            >
                                {isArchived ? "Unarchive Channel" : "Archive Channel"}
                            </Button>
                        )}
                    </div>

                    <div>
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
                                    variant={resolvedPreference === option.value ? "default" : "outline"}
                                    onClick={() => onUpdateNotificationPreference?.(option.value)}
                                    disabled={!onUpdateNotificationPreference || isUpdatingPreference}
                                >
                                    {option.label}
                                </Button>
                            ))}
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                            Control badge counts and notification noise for this channel.
                        </p>
                    </div>

                    <div>
                        <h4 className="text-sm font-semibold mb-2">
                            Members ({members.length})
                        </h4>
                        <div className="max-h-[200px] overflow-y-auto space-y-2">
                            {members.length > 0 ? (
                                members.map((member: any) => (
                                    <div
                                        key={member.userId}
                                        className="flex items-center gap-3 rounded border p-2"
                                    >
                                        <div className="relative">
                                            <Avatar className="h-8 w-8">
                                                <AvatarImage src={resolveAssetUrl(member.user?.image)} />
                                                <AvatarFallback>
                                                    <UserIcon className="h-4 w-4" />
                                                </AvatarFallback>
                                            </Avatar>
                                            <PresenceIndicator
                                                userId={member.userId}
                                                className="absolute -bottom-0.5 -right-0.5 border-white"
                                                size="md"
                                            />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold truncate">
                                                {member.user?.name || member.user?.email}
                                            </p>
                                            <p className="text-xs text-gray-500 truncate">
                                                {member.user?.email}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-gray-500">No members yet.</p>
                            )}
                        </div>
                    </div>

                    <div>
                        <h4 className="text-sm font-semibold mb-2">Add People</h4>
                        <Input
                            placeholder="Search by name or email"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="mb-3"
                        />
                        <div className="max-h-[200px] overflow-y-auto space-y-1">
                            {filteredUsers.length > 0 ? (
                                filteredUsers.map((user: any) => (
                                    <div
                                        key={user.id}
                                        className="flex items-center justify-between gap-3 rounded border p-2"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="relative">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarImage src={resolveAssetUrl(user.image)} />
                                                    <AvatarFallback>
                                                        <UserIcon className="h-4 w-4" />
                                                    </AvatarFallback>
                                                </Avatar>
                                                <PresenceIndicator
                                                    userId={user.id}
                                                    className="absolute -bottom-0.5 -right-0.5 border-white"
                                                    size="md"
                                                />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold truncate">
                                                    {user.name || user.email}
                                                </p>
                                                <p className="text-xs text-gray-500 truncate">
                                                    {user.email}
                                                </p>
                                            </div>
                                        </div>
                                        <Button
                                            size="sm"
                                            onClick={() => onAddUser(user.id)}
                                            disabled={isAdding}
                                        >
                                            Add
                                        </Button>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-gray-500">
                                    No available users match your search.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
