import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/api-client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { authClient } from "@/lib/auth-client";
import { useEffect, useState } from "react";
import { SidebarHeader } from "./sidebar/SidebarHeader";
import { ProfileDialog, CreateChannelDialog } from "./sidebar/SidebarDialogs";
import { NewDMDialog } from "./sidebar/NewDMDialog";
import { SettingsDialog } from "./SettingsDialog";
import { WorkspaceSettingsDialog } from "./WorkspaceSettingsDialog";
import { StarredSection } from "./sidebar/StarredSection";
import { ChannelsSection } from "./sidebar/ChannelsSection";
import { DMSection } from "./sidebar/DMSection";
import { ThreadsLink } from "./sidebar/ThreadsLink";
import { BookmarksLink } from "./sidebar/BookmarksLink";
import { useOrganization } from "@/contexts/OrganizationContext";
import SearchDialog from "./SearchDialog";
import { Search } from "lucide-react";

// Reusable sidebar content for desktop and mobile
export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
    const { channelId, sessionId } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isDMDialogOpen, setIsDMDialogOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isWorkspaceSettingsOpen, setIsWorkspaceSettingsOpen] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    // Persistent state
    const [channelsOpen, setChannelsOpen] = useState(() => localStorage.getItem("channelsOpen") !== "false");
    const [dmsOpen, setDmsOpen] = useState(() => localStorage.getItem("dmsOpen") !== "false");
    const [starredOpen, setStarredOpen] = useState(() => localStorage.getItem("starredOpen") !== "false");

    const toggleStarred = () => {
        const newState = !starredOpen;
        setStarredOpen(newState);
        localStorage.setItem("starredOpen", String(newState));
    };

    const toggleChannels = () => {
        const newState = !channelsOpen;
        setChannelsOpen(newState);
        localStorage.setItem("channelsOpen", String(newState));
    };

    const toggleDms = () => {
        const newState = !dmsOpen;
        setDmsOpen(newState);
        localStorage.setItem("dmsOpen", String(newState));
    };

    useEffect(() => {
        const handler = (event: KeyboardEvent) => {
            const isCmdOrCtrl = event.metaKey || event.ctrlKey;
            if (isCmdOrCtrl && event.key.toLowerCase() === "k") {
                event.preventDefault();
                setIsSearchOpen(true);
            }
        };

        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, []);

    const { data: sessionData } = authClient.useSession();
    const currentUserId = sessionData?.user?.id;
    const { data: currentUserProfile } = useQuery({
        queryKey: ['me'],
        queryFn: () => api.users.me(),
        enabled: !!currentUserId
    });
    const currentUser = currentUserProfile ?? sessionData?.user;
    const { currentOrganization } = useOrganization();
    const isOrgAdmin = currentOrganization?.role === 'ADMIN';

    const { data: channels } = useQuery({
        queryKey: ['channels'],
        queryFn: () => api.channels.list(true),
        refetchInterval: 5000
    });

    const { data: dms } = useQuery({
        queryKey: ['dms'],
        queryFn: () => api.dms.list(true),
        refetchInterval: 5000
    });

    const { data: users } = useQuery({
        queryKey: ['users'],
        queryFn: () => api.users.list(),
        enabled: isDMDialogOpen
    });

    const createMutation = useMutation({
        mutationFn: (data: { name: string; description: string; isPrivate: boolean }) =>
            api.channels.create(data),
        onSuccess: (data: any) => {
            queryClient.invalidateQueries({ queryKey: ['channels'] });
            setIsDialogOpen(false);
            if (data?.id) {
                navigate(`/channels/${data.id}`);
                onNavigate?.(); // Close mobile sidebar if present
            }
            if (!channelsOpen) toggleChannels();
        }
    });

    const createDMMutation = useMutation({
        mutationFn: (userId: string) => api.dms.create(userId),
        onSuccess: (data: any) => {
            queryClient.invalidateQueries({ queryKey: ['dms'] });
            setIsDMDialogOpen(false);
            if (data?.id) {
                navigate(`/dms/${data.id}`);
                onNavigate?.(); // Close mobile sidebar if present
            }
            if (!dmsOpen) toggleDms();
        }
    });

    const updateProfileMutation = useMutation({
        mutationFn: api.users.update,
        onSuccess: (updatedUser) => {
            queryClient.setQueryData(['me'], updatedUser);
            queryClient.invalidateQueries({ queryKey: ['me'] });
            queryClient.invalidateQueries({ queryKey: ['users'] });
            queryClient.invalidateQueries({ queryKey: ['channels'] });
            queryClient.invalidateQueries({ queryKey: ['dms'] });
            queryClient.invalidateQueries({ queryKey: ['messages'] });
            queryClient.invalidateQueries({ queryKey: ['dm_messages'] });
            setIsProfileOpen(false);
        }
    });

    const uploadAvatarMutation = useMutation({
        mutationFn: (file: File) => api.users.uploadAvatar(file),
        onSuccess: (updatedUser) => {
            queryClient.setQueryData(['me'], updatedUser);
            queryClient.invalidateQueries({ queryKey: ['me'] });
            queryClient.invalidateQueries({ queryKey: ['users'] });
            queryClient.invalidateQueries({ queryKey: ['channels'] });
            queryClient.invalidateQueries({ queryKey: ['dms'] });
            queryClient.invalidateQueries({ queryKey: ['messages'] });
            queryClient.invalidateQueries({ queryKey: ['dm_messages'] });
        }
    });

    const starChannelMutation = useMutation({
        mutationFn: ({ id, isStarred }: { id: string; isStarred: boolean }) => api.channels.star(id, isStarred),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['channels'] })
    });

    const starDMMutation = useMutation({
        mutationFn: ({ id, isStarred }: { id: string; isStarred: boolean }) => api.dms.star(id, isStarred),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dms'] })
    });

    const handleLogout = async () => {
        await authClient.signOut();
        queryClient.clear();
        navigate('/login');
    };

    const activeChannels = channels?.filter((c: any) => !c.isArchived) || [];
    const archivedChannels = channels?.filter((c: any) => c.isArchived) || [];
    const activeDms = dms?.filter((d: any) => !d.isArchived) || [];
    const archivedDms = dms?.filter((d: any) => d.isArchived) || [];

    const starredChannels = activeChannels.filter((c: any) => c.isStarred);
    const starredDms = activeDms.filter((d: any) => d.isStarred);

    return (
        <div className="flex flex-col h-full bg-sidebar border-r border-sidebar-border flex-shrink-0 backdrop-blur-sm">
            <SidebarHeader
                userName={currentUser?.name || "User"}
                userImage={currentUser?.image || undefined}
                isAdmin={isOrgAdmin}
                onProfileClick={() => setIsProfileOpen(true)}
                onSettingsClick={() => setIsSettingsOpen(true)}
                onWorkspaceSettingsClick={() => setIsWorkspaceSettingsOpen(true)}
                onLogoutClick={handleLogout}
            />

            <div className="px-3 pt-3">
                <button
                    type="button"
                    onClick={() => setIsSearchOpen(true)}
                    className="flex w-full items-center gap-2 rounded-lg bg-white/60 dark:bg-white/5 px-3 py-2 text-sm text-sidebar-text hover:bg-white/80 dark:hover:bg-white/10 transition-all border border-sidebar-border shadow-sm"
                >
                    <Search className="h-4 w-4 text-sidebar-text-muted" />
                    <span>Search</span>
                    <span className="ml-auto text-xs text-sidebar-text-muted bg-white/50 dark:bg-white/10 px-1.5 py-0.5 rounded">Cmd+K</span>
                </button>
            </div>

            <ScrollArea className="flex-1 mt-2">
                <div className="space-y-1 pb-4">
                    <ThreadsLink />
                    <BookmarksLink />

                    <StarredSection
                        starredChannels={starredChannels}
                        starredDms={starredDms}
                        currentUserId={currentUser?.id}
                        activeChannelId={channelId}
                        activeSessionId={sessionId}
                    />

                    <ChannelsSection
                        channels={activeChannels}
                        activeChannelId={channelId}
                        onAddChannel={() => setIsDialogOpen(true)}
                    />

                    <DMSection
                        dms={activeDms}
                        currentUserId={currentUser?.id}
                        activeSessionId={sessionId}
                        onAddDM={() => setIsDMDialogOpen(true)}
                    />

                    {archivedChannels.length > 0 && (
                        <ChannelsSection
                            channels={archivedChannels}
                            activeChannelId={channelId}
                            label="Archived Channels"
                        />
                    )}

                    {archivedDms.length > 0 && (
                        <DMSection
                            dms={archivedDms}
                            currentUserId={currentUser?.id}
                            activeSessionId={sessionId}
                            label="Archived DMs"
                        />
                    )}
                </div>
            </ScrollArea>

            {/* Dialogs */}
            <CreateChannelDialog
                isOpen={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                onCreate={(data) => createMutation.mutate(data)}
            />

            <NewDMDialog
                isOpen={isDMDialogOpen}
                onOpenChange={setIsDMDialogOpen}
                users={users?.filter((u: any) => u.id !== currentUser?.id) || []}
                onSelect={(userId) => createDMMutation.mutate(userId)}
            />

            <ProfileDialog
                isOpen={isProfileOpen}
                onOpenChange={setIsProfileOpen}
                user={currentUser}
                onSave={(data) => updateProfileMutation.mutate(data)}
                onUploadAvatar={(file) => uploadAvatarMutation.mutate(file)}
                isUploadingAvatar={uploadAvatarMutation.isPending}
            />

            <SettingsDialog
                isOpen={isSettingsOpen}
                onOpenChange={setIsSettingsOpen}
            />

            <WorkspaceSettingsDialog
                isOpen={isWorkspaceSettingsOpen}
                onOpenChange={setIsWorkspaceSettingsOpen}
            />

            <SearchDialog
                isOpen={isSearchOpen}
                onOpenChange={setIsSearchOpen}
                currentUserId={currentUser?.id}
            />
        </div>
    );
}

// Desktop sidebar wrapper with fixed width
export default function Sidebar() {
    return (
        <div className="w-64">
            <SidebarContent />
        </div>
    );
}
