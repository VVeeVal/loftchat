import { useRef, useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { resolveAssetUrl } from "@/lib/assets";

interface ProfileDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    user: any;
    onSave: (data: { name: string; bio: string }) => void;
    onUploadAvatar?: (file: File) => void;
    isUploadingAvatar?: boolean;
}

export function ProfileDialog({ isOpen, onOpenChange, user, onSave, onUploadAvatar, isUploadingAvatar }: ProfileDialogProps) {
    const [name, setName] = useState("");
    const [bio, setBio] = useState("");
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        if (user) {
            setName(user.name || "");
            setBio(user.bio || "");
        }
        if (!isOpen) {
            setAvatarPreview(null);
        }
    }, [user, isOpen]);

    useEffect(() => {
        if (!avatarPreview) return;
        return () => {
            URL.revokeObjectURL(avatarPreview);
        };
    }, [avatarPreview]);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Edit Profile</DialogTitle>
                    <DialogDescription className="sr-only">
                        Update your display name and bio.
                    </DialogDescription>
                </DialogHeader>
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        onSave({ name, bio });
                    }}
                >
                    <div className="grid gap-4 py-4">
                        <div className="flex items-center gap-4">
                        <Avatar className="h-16 w-16 rounded-sm">
                            <AvatarImage src={avatarPreview || resolveAssetUrl(user?.image)} />
                            <AvatarFallback className="text-xl">{user?.name?.[0]}</AvatarFallback>
                        </Avatar>
                            <div className="space-y-2">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    onChange={(event) => {
                                        const file = event.target.files?.[0];
                                        if (!file) return;
                                        setAvatarPreview(URL.createObjectURL(file));
                                        onUploadAvatar?.(file);
                                    }}
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isUploadingAvatar}
                                >
                                    {isUploadingAvatar ? "Uploading..." : "Upload Avatar"}
                                </Button>
                            </div>
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-semibold">Display Name</label>
                            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full Name" />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-semibold">Bio</label>
                            <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="What do you do?" rows={4} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit">Save Changes</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

interface CreateChannelDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onCreate: (data: { name: string; description: string; isPrivate: boolean }) => void;
}

export function CreateChannelDialog({ isOpen, onOpenChange, onCreate }: CreateChannelDialogProps) {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [isPrivate, setIsPrivate] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setName("");
            setDescription("");
            setIsPrivate(false);
        }
    }, [isOpen]);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create a Channel</DialogTitle>
                    <DialogDescription className="sr-only">
                        Create a new channel for this workspace.
                    </DialogDescription>
                </DialogHeader>
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        onCreate({ name, description, isPrivate });
                    }}
                >
                    <div className="grid gap-4 py-4">
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-semibold">Name</label>
                            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. project-x" />
                            <p className="text-xs text-gray-400">Channels are where your team communicates.</p>
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-semibold">Description (Optional)</label>
                            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's this channel about?" />
                        </div>
                        <div className="flex items-center gap-2">
                            <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} id="isPrivate" />
                            <label htmlFor="isPrivate" className="text-sm font-semibold cursor-pointer">Make private</label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit">Create Channel</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
