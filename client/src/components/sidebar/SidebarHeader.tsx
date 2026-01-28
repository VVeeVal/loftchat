import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, LogOut, Settings, User } from "lucide-react";
import { LoftLogo } from "@/components/LoftLogo";
import { resolveAssetUrl } from "@/lib/assets";

interface SidebarHeaderProps {
    userName: string;
    userImage?: string;
    isAdmin?: boolean;
    onProfileClick: () => void;
    onSettingsClick?: () => void;
    onWorkspaceSettingsClick?: () => void;
    onLogoutClick: () => void;
}

export function SidebarHeader({ userName, userImage, isAdmin, onProfileClick, onSettingsClick, onWorkspaceSettingsClick, onLogoutClick }: SidebarHeaderProps) {
    return (
        <div className="h-14 flex items-center px-4 border-b border-sidebar-border bg-sidebar z-10 flex-shrink-0">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 hover:bg-sidebar-hover p-1.5 rounded-lg transition-colors group">
                        <LoftLogo size="sm" showText={true} />
                        <ChevronDown className="h-4 w-4 text-sidebar-text-muted group-hover:text-sidebar-text transition-colors" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuItem onClick={onProfileClick}>
                        <User className="mr-2 h-4 w-4" />
                        <span>Profile</span>
                    </DropdownMenuItem>
                    {onSettingsClick && (
                        <DropdownMenuItem onClick={onSettingsClick}>
                            <Settings className="mr-2 h-4 w-4" />
                            <span>Settings</span>
                        </DropdownMenuItem>
                    )}
                    {isAdmin && onWorkspaceSettingsClick && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={onWorkspaceSettingsClick}>
                                <Settings className="mr-2 h-4 w-4" />
                                <span>Workspace Settings</span>
                            </DropdownMenuItem>
                        </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onLogoutClick}>
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Log out</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <div className="ml-auto">
                <Avatar className="h-8 w-8 rounded-lg cursor-pointer ring-2 ring-white/50 dark:ring-white/20 shadow-sm hover:ring-primary/50 transition-all" onClick={onProfileClick}>
                    <AvatarImage src={resolveAssetUrl(userImage)} />
                    <AvatarFallback className="bg-gradient-to-br from-loft-mint to-primary text-white rounded-lg font-medium">{userName?.[0]}</AvatarFallback>
                </Avatar>
            </div>
        </div>
    );
}
