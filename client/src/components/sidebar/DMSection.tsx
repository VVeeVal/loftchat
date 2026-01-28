import { Link } from "react-router-dom";
import { User as UserIcon } from "lucide-react";
import { SidebarCategory, SidebarItem } from "./SidebarComponents";
import { PresenceIndicator } from "../PresenceIndicator";

interface DMSectionProps {
    dms: any[];
    currentUserId?: string;
    activeSessionId?: string;
    onAddDM?: () => void;
    label?: string;
}

export function DMSection({ dms, currentUserId, activeSessionId, onAddDM, label = "Direct Messages" }: DMSectionProps) {
    const sortedDms = [...(dms || [])].sort((a, b) => {
        const getLabel = (dm: any) => {
            const other = dm.participants.find((p: any) => p.userId !== currentUserId)?.user;
            return (other?.name || other?.email || "Unknown").toLowerCase();
        };
        return getLabel(a).localeCompare(getLabel(b));
    });

    return (
        <SidebarCategory label={label} onAdd={onAddDM}>
            {sortedDms.map((dm: any) => {
                const otherParticipant = dm.participants.find((p: any) => p.userId !== currentUserId);
                const other = otherParticipant?.user;
                const otherUserId = otherParticipant?.userId;
                return (
                    <Link key={dm.id} to={`/dms/${dm.id}`}>
                        <SidebarItem
                            icon={
                                <div className="relative">
                                    <UserIcon className="h-4 w-4" />
                                    {otherUserId && (
                                        <PresenceIndicator
                                            userId={otherUserId}
                                            className="absolute -bottom-1 -right-1"
                                            size="sm"
                                        />
                                    )}
                                </div>
                            }
                            label={other?.name || other?.email || "Unknown"}
                            isActive={activeSessionId === dm.id}
                            unreadCount={dm.unreadCount}
                            onClick={() => { }}
                        />
                    </Link>
                );
            })}
        </SidebarCategory>
    );
}
