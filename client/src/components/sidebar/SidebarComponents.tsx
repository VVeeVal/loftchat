import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface SidebarCategoryProps {
    label: string;
    onAdd?: () => void;
    children: React.ReactNode;
}

export function SidebarCategory({ label, onAdd, children }: SidebarCategoryProps) {
    return (
        <div className="mb-4">
            <div className="flex items-center justify-between px-4 mb-2 group/cat">
                <span className="text-xs font-semibold text-sidebar-text-muted uppercase tracking-widest">{label}</span>
                {onAdd && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 opacity-0 group-hover/cat:opacity-100 transition-opacity hover:bg-sidebar-hover text-sidebar-text-muted hover:text-sidebar-text"
                        onClick={(e) => {
                            e.stopPropagation();
                            onAdd();
                        }}
                    >
                        <Plus className="h-3 w-3" />
                    </Button>
                )}
            </div>
            <div className="space-y-[2px]">
                {children}
            </div>
        </div>
    );
}

interface SidebarItemProps {
    icon: React.ReactNode;
    label: string;
    isActive?: boolean;
    onClick: () => void;
    unreadCount?: number;
    isStarred?: boolean;
}

export function SidebarItem({ icon, label, isActive, onClick, unreadCount, isStarred }: SidebarItemProps) {
    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center px-4 py-1.5 text-sm transition-all group rounded-r-lg mr-2 ${isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-sidebar-text hover:bg-sidebar-hover"
                }`}
        >
            <span className={`mr-2 transition-colors ${isActive ? "text-primary-foreground" : "text-sidebar-text-muted group-hover:text-sidebar-text"}`}>
                {icon}
            </span>
            <span className={`flex-1 text-left truncate ${unreadCount && unreadCount > 0 ? "font-semibold" : ""}`}>
                {label}
            </span>
            {unreadCount !== undefined && unreadCount > 0 && (
                <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center ml-1 shadow-sm">
                    {unreadCount}
                </span>
            )}
        </button>
    );
}
