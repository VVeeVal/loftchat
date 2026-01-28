import { Link } from "react-router-dom";
import { MessageSquareText } from "lucide-react";
import { SidebarItem } from "./SidebarComponents";

export function ThreadsLink() {
    return (
        <Link to="/threads">
            <SidebarItem
                icon={<MessageSquareText className="h-4 w-4" />}
                label="Threads"
                onClick={() => { }}
            />
        </Link>
    );
}
