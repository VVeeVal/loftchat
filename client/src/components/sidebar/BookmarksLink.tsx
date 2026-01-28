import { Link } from "react-router-dom";
import { Bookmark } from "lucide-react";
import { SidebarItem } from "./SidebarComponents";

export function BookmarksLink() {
    return (
        <Link to="/bookmarks">
            <SidebarItem
                icon={<Bookmark className="h-4 w-4" />}
                label="Bookmarks"
                onClick={() => { }}
            />
        </Link>
    );
}
