import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ChangePasswordDialog } from "./ChangePasswordDialog";
import { useNotifications } from "@/hooks/useNotifications";
import { useInputSettings } from "@/hooks/useInputSettings";
import { Bell, BellOff, Key, Send } from "lucide-react";

interface SettingsDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ isOpen, onOpenChange }: SettingsDialogProps) {
    const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
    const { isSupported, permission, isEnabled, canNotify, requestPermission, setEnabled, showNotification } = useNotifications();
    const { settings, setCodeBlockEnterPrevents, setEnterBehavior } = useInputSettings();

    const handleEnableNotifications = async () => {
        if (permission === 'default') {
            const result = await requestPermission();
            if (result === 'granted') {
                setEnabled(true);
            }
        } else if (permission === 'granted') {
            setEnabled(!isEnabled);
        }
    };

    const handleTestNotification = () => {
        // Force show notification even if window is focused for testing
        if (!isSupported || permission !== 'granted') {
            return;
        }

        try {
            const notification = new Notification('Test Notification', {
                body: 'Notifications are working correctly!',
                icon: '/loft-icon.svg',
                badge: '/loft-icon.svg',
            });

            setTimeout(() => notification.close(), 5000);
        } catch (error) {
            console.error('Failed to show test notification:', error);
        }
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onOpenChange}>
                <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Settings</DialogTitle>
                        <DialogDescription className="sr-only">
                            Manage personal account settings.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6">
                        {/* Notifications Section */}
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                    {canNotify ? <Bell className="h-4 w-4 text-primary" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}
                                    Browser Notifications
                                </h3>
                                <p className="text-sm text-muted-foreground mb-4">
                                    Get notified when you receive new messages while the tab is not focused.
                                </p>
                            </div>

                            {!isSupported ? (
                                <div className="rounded-lg bg-secondary/50 p-3 text-sm text-muted-foreground">
                                    Browser notifications are not supported in your browser.
                                </div>
                            ) : permission === 'denied' ? (
                                <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                                    Notifications are blocked. Please enable them in your browser settings.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between rounded-lg bg-secondary/30 p-3">
                                        <Label htmlFor="notifications-toggle" className="text-sm font-medium">
                                            {permission === 'default' ? 'Enable notifications' : 'Notifications enabled'}
                                        </Label>
                                        <Switch
                                            id="notifications-toggle"
                                            checked={canNotify}
                                            onCheckedChange={handleEnableNotifications}
                                        />
                                    </div>

                                    {permission === 'granted' && (
                                        <div className="space-y-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="w-full"
                                                onClick={handleTestNotification}
                                            >
                                                <Send className="h-4 w-4 mr-2" />
                                                Send Test Notification
                                            </Button>
                                            <p className="text-xs text-muted-foreground">
                                                Note: Notifications only appear when the Loft tab is not focused or is minimized.
                                                The test notification above bypasses this check for testing purposes.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="border-t border-border/50 pt-4">
                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-sm font-semibold mb-2">Message Input</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Customize how your message input behaves.
                                    </p>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between rounded-lg bg-secondary/30 p-3">
                                        <Label htmlFor="enter-behavior" className="text-sm font-medium">
                                            {settings.enterBehavior === 'send'
                                                ? 'Enter sends message'
                                                : 'Enter inserts newline'}
                                        </Label>
                                        <Switch
                                            id="enter-behavior"
                                            checked={settings.enterBehavior === 'send'}
                                            onCheckedChange={(checked) => setEnterBehavior(checked ? 'send' : 'newline')}
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {settings.enterBehavior === 'send'
                                            ? 'Use Shift+Enter for a new line.'
                                            : 'Use Ctrl+Enter or Cmd+Enter to send.'}
                                    </p>
                                </div>

                                <div className="flex items-center justify-between rounded-lg bg-secondary/30 p-3">
                                    <Label htmlFor="codeblock-enter" className="text-sm font-medium">
                                        Prevent Enter from sending inside code blocks
                                    </Label>
                                    <Switch
                                        id="codeblock-enter"
                                        checked={settings.codeBlockEnterPrevents}
                                        onCheckedChange={setCodeBlockEnterPrevents}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-border/50 pt-4">
                            <div>
                                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                    <Key className="h-4 w-4 text-muted-foreground" />
                                    Security
                                </h3>
                                <p className="text-sm text-muted-foreground mb-4">
                                    Update your password to keep your account secure.
                                </p>
                            </div>
                            <Button
                                variant="outline"
                                onClick={() => setIsChangePasswordOpen(true)}
                                className="w-full"
                            >
                                Change Password
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <ChangePasswordDialog
                isOpen={isChangePasswordOpen}
                onOpenChange={setIsChangePasswordOpen}
            />
        </>
    );
}
