import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { Copy, Check } from "lucide-react";
import { UserManagementSection } from "./UserManagementSection";
import { PasswordResetDialog } from "./PasswordResetDialog";
import { useOrganization } from "@/contexts/OrganizationContext";

interface WorkspaceSettingsProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

export function WorkspaceSettings({ isOpen, onOpenChange }: WorkspaceSettingsProps) {
    const [expiresInHours, setExpiresInHours] = useState<string>("48");
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [multiUseEnabled, setMultiUseEnabled] = useState(false);
    const [maxUses, setMaxUses] = useState<string>("");
    const [passwordResetOpen, setPasswordResetOpen] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState<string>("");
    const [selectedUserName, setSelectedUserName] = useState<string>("");
    const queryClient = useQueryClient();
    const { currentOrganization } = useOrganization();
    const isOrgAdmin = currentOrganization?.role === 'ADMIN';

    const handleResetPassword = (userId: string, userName: string) => {
        setSelectedUserId(userId);
        setSelectedUserName(userName);
        setPasswordResetOpen(true);
    };

    const { data: links } = useQuery({
        queryKey: ['registration-links'],
        queryFn: () => api.registrationLinks.list(),
        enabled: isOpen
    });

    const createLinkMutation = useMutation({
        mutationFn: (payload: { expiresInHours?: number; usageLimit?: number; allowUnlimited?: boolean }) =>
            api.registrationLinks.create(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['registration-links'] });
            setExpiresInHours("48");
            setMultiUseEnabled(false);
            setMaxUses("");
        }
    });

    const handleCreateLink = () => {
        const hours = expiresInHours ? parseInt(expiresInHours) : undefined;
        if (hours && (hours <= 0 || isNaN(hours))) {
            return;
        }
        let usageLimit: number | undefined;
        let allowUnlimited: boolean | undefined;

        if (multiUseEnabled) {
            const parsedUses = maxUses ? parseInt(maxUses) : undefined;
            if (parsedUses && parsedUses > 0) {
                usageLimit = parsedUses;
            } else {
                allowUnlimited = true;
            }
        }

        createLinkMutation.mutate({ expiresInHours: hours, usageLimit, allowUnlimited });
    };

    const handleCopyLink = (url: string, id: string) => {
        navigator.clipboard.writeText(url);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const isLinkExpired = (link: any) => {
        if (!link.expiresAt) return false;
        return new Date(link.expiresAt) < new Date();
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Workspace Settings</DialogTitle>
                        <DialogDescription className="sr-only">
                            Manage workspace registration links and user access.
                        </DialogDescription>
                    </DialogHeader>
                    <Tabs defaultValue="registration" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="registration">Registration Links</TabsTrigger>
                            {isOrgAdmin && (
                                <TabsTrigger value="users">User Management</TabsTrigger>
                            )}
                        </TabsList>

                        <TabsContent value="registration" className="space-y-4">
                            <div className="grid gap-6 py-4">
                    {/* Generate New Link Section */}
                    <div className="flex flex-col gap-4 border-b pb-4">
                        <div>
                            <h3 className="text-sm font-semibold mb-2">Generate Registration Link</h3>
                            <p className="text-xs text-gray-400 mb-3">
                                Create invitation links for new users to join this workspace.
                            </p>
                        </div>
                    <form
                        className="flex flex-wrap items-end gap-2"
                        onSubmit={(event) => {
                            event.preventDefault();
                            handleCreateLink();
                        }}
                    >
                        <Input
                            type="number"
                            placeholder="Validity in hours (optional)"
                            value={expiresInHours}
                            onChange={(e) => setExpiresInHours(e.target.value)}
                            className="max-w-[200px]"
                        />
                        <span className="text-xs text-gray-500">
                            Entered number = link validity in hours.
                        </span>
                        <label className="flex items-center gap-2 text-xs text-gray-500">
                            <input
                                type="checkbox"
                                checked={multiUseEnabled}
                                onChange={(event) => setMultiUseEnabled(event.target.checked)}
                            />
                            Allow multiple uses
                        </label>
                        {multiUseEnabled && (
                            <Input
                                type="number"
                                placeholder="Max uses (leave blank for unlimited)"
                                value={maxUses}
                                onChange={(e) => setMaxUses(e.target.value)}
                                className="max-w-[220px]"
                            />
                        )}
                        <Button
                            type="submit"
                            disabled={createLinkMutation.isPending}
                        >
                            {createLinkMutation.isPending ? "Creating..." : "Generate Link"}
                        </Button>
                    </form>
                    </div>

                    {/* Existing Links Section */}
                    <div className="flex flex-col gap-2">
                        <h3 className="text-sm font-semibold">Registration Links</h3>
                        {links && links.length > 0 ? (
                            <div className="space-y-2">
                                {links.map((link: any) => {
                                    const expired = isLinkExpired(link);
                                    const isUsed = link.isUsed;
                                    const isCopied = copiedId === link.id;

                                    return (
                                        <div
                                            key={link.id}
                                            className="flex items-center gap-2 p-3 border rounded-md bg-gray-50 dark:bg-gray-900"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <code className="text-xs bg-white dark:bg-gray-800 px-2 py-1 rounded break-all">
                                                        {link.registrationUrl}
                                                    </code>
                                                </div>
                                                <div className="flex gap-3 text-xs text-gray-500">
                                                    <span>
                                                        {link.isUsed
                                                            ? "Used"
                                                            : expired
                                                            ? "Expired"
                                                            : "Active"}
                                                    </span>
                                                    {typeof link.usageLimit === 'number' && (
                                                        <span>
                                                            Uses: {link.usageCount ?? 0}/{link.usageLimit}
                                                        </span>
                                                    )}
                                                    {link.usageLimit === null && (
                                                        <span>
                                                            Uses: {link.usageCount ?? 0}/∞
                                                        </span>
                                                    )}
                                                    {link.createdAt && (
                                                        <span>
                                                            Created: {new Date(link.createdAt).toLocaleDateString()}
                                                        </span>
                                                    )}
                                                    {link.expiresAt && (
                                                        <span>
                                                            Expires: {new Date(link.expiresAt).toLocaleDateString()}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleCopyLink(link.registrationUrl, link.id)}
                                                disabled={isUsed || expired}
                                            >
                                                {isCopied ? (
                                                    <>
                                                        <Check className="h-4 w-4 mr-1" />
                                                        Copied
                                                    </>
                                                ) : (
                                                    <>
                                                        <Copy className="h-4 w-4 mr-1" />
                                                        Copy
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-400">
                                No registration links created yet. Generate one above.
                            </p>
                        )}
                    </div>
                            </div>
                        </TabsContent>

                        {isOrgAdmin && (
                            <TabsContent value="users" className="space-y-4">
                                <UserManagementSection onResetPassword={handleResetPassword} />
                            </TabsContent>
                        )}
                    </Tabs>
                </DialogContent>
            </Dialog>

            <PasswordResetDialog
                isOpen={passwordResetOpen}
                onOpenChange={setPasswordResetOpen}
                userId={selectedUserId}
                userName={selectedUserName}
            />
        </>
    );
}
