import { Link } from "react-router-dom";
import { Hash, Lock } from "lucide-react";
import { SidebarCategory, SidebarItem } from "./SidebarComponents";

interface ChannelsSectionProps {
    channels: any[];
    activeChannelId?: string;
    onAddChannel?: () => void;
    label?: string;
}

export function ChannelsSection({ channels, activeChannelId, onAddChannel, label = "Channels" }: ChannelsSectionProps) {
    return (
        <SidebarCategory label={label} onAdd={onAddChannel}>
            {channels?.map((c: any) => (
                <Link key={c.id} to={`/channels/${c.id}`}>
                    <SidebarItem
                        icon={c.isPrivate ? <Lock className="h-4 w-4" /> : <Hash className="h-4 w-4" />}
                        label={c.name}
                        isActive={activeChannelId === c.id}
                        unreadCount={c.unreadCount}
                        onClick={() => { }}
                    />
                </Link>
            ))}
        </SidebarCategory>
    );
}
