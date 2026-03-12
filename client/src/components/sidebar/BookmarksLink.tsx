import { Link } from "react-router-dom";
import { Bookmark } from "lucide-react";
import { SidebarItem } from "./SidebarComponents";

interface BookmarksLinkProps {
    onNavigate?: () => void;
}

export function BookmarksLink({ onNavigate }: BookmarksLinkProps) {
    return (
        <Link to="/bookmarks" onClick={onNavigate}>
            <SidebarItem
                icon={<Bookmark className="h-4 w-4" />}
                label="Bookmarks"
                onClick={() => onNavigate?.()}
            />
        </Link>
    );
}
