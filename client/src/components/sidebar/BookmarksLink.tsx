import { Bookmark } from "lucide-react";
import { SidebarItem } from "./SidebarComponents";

interface BookmarksLinkProps {
    onNavigate?: () => void;
}

export function BookmarksLink({ onNavigate }: BookmarksLinkProps) {
    return (
        <SidebarItem
            to="/bookmarks"
            icon={<Bookmark className="h-4 w-4" />}
            label="Bookmarks"
            onClick={() => onNavigate?.()}
        />
    );
}
