import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User as UserIcon } from "lucide-react";
import { resolveAssetUrl } from "@/lib/assets";

interface NewDMDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    users: any[];
    onSelect: (userId: string) => void;
}

export function NewDMDialog({ isOpen, onOpenChange, users, onSelect }: NewDMDialogProps) {
    const [search, setSearch] = useState("");

    useEffect(() => {
        if (isOpen) setSearch("");
    }, [isOpen]);

    const filteredUsers = users?.filter(u =>
        u.name?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Direct Messages</DialogTitle>
                    <DialogDescription className="sr-only">
                        Start a direct message with a teammate.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Input
                        placeholder="Type a name or email"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="mb-4"
                    />
                    <div className="max-h-[300px] overflow-y-auto space-y-1">
                        {filteredUsers?.map(user => (
                            <button
                                key={user.id}
                                className="w-full flex items-center p-2 rounded hover:bg-gray-100 transition-colors gap-3"
                                onClick={() => onSelect(user.id)}
                            >
                                <Avatar className="h-8 w-8">
                                    <AvatarImage src={resolveAssetUrl(user.image)} />
                                    <AvatarFallback><UserIcon className="h-4 w-4" /></AvatarFallback>
                                </Avatar>
                                <div className="text-left">
                                    <p className="text-sm font-bold">{user.name}</p>
                                    <p className="text-xs text-gray-500">{user.email}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
