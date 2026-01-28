import { Link } from "react-router-dom";
import { Hash, User as UserIcon } from "lucide-react";
import { SidebarCategory, SidebarItem } from "./SidebarComponents";

interface StarredSectionProps {
    starredChannels: any[];
    starredDms: any[];
    currentUserId?: string;
    activeChannelId?: string;
    activeSessionId?: string;
}

export function StarredSection({ starredChannels, starredDms, currentUserId, activeChannelId, activeSessionId }: StarredSectionProps) {
    if (starredChannels.length === 0 && starredDms.length === 0) {
        return null;
    }

    return (
        <SidebarCategory label="Starred">
            {starredChannels.map((c: any) => (
                <Link key={c.id} to={`/channels/${c.id}`}>
                    <SidebarItem
                        icon={<Hash className="h-4 w-4" />}
                        label={c.name}
                        isActive={activeChannelId === c.id}
                        onClick={() => { }}
                        isStarred={true}
                    />
                </Link>
            ))}
            {starredDms.map((dm: any) => {
                const other = dm.participants.find((p: any) => p.userId !== currentUserId)?.user;
                return (
                    <Link key={dm.id} to={`/dms/${dm.id}`}>
                        <SidebarItem
                            icon={<UserIcon className="h-4 w-4" />}
                            label={other?.name || other?.email || "Unknown"}
                            isActive={activeSessionId === dm.id}
                            onClick={() => { }}
                            isStarred={true}
                        />
                    </Link>
                );
            })}
        </SidebarCategory>
    );
}
