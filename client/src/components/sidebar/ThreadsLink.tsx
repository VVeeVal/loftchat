import { MessageSquareText } from "lucide-react";
import { SidebarItem } from "./SidebarComponents";

interface ThreadsLinkProps {
    onNavigate?: () => void;
}

export function ThreadsLink({ onNavigate }: ThreadsLinkProps) {
    return (
        <SidebarItem
            to="/threads"
            icon={<MessageSquareText className="h-4 w-4" />}
            label="Threads"
            onClick={() => onNavigate?.()}
        />
    );
}
