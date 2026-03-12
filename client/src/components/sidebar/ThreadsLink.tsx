import { Link } from "react-router-dom";
import { MessageSquareText } from "lucide-react";
import { SidebarItem } from "./SidebarComponents";

interface ThreadsLinkProps {
    onNavigate?: () => void;
}

export function ThreadsLink({ onNavigate }: ThreadsLinkProps) {
    return (
        <Link to="/threads" onClick={onNavigate}>
            <SidebarItem
                icon={<MessageSquareText className="h-4 w-4" />}
                label="Threads"
                onClick={() => onNavigate?.()}
            />
        </Link>
    );
}
