import { Bookmark, MessageSquare, Pencil, Pin, Smile, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import EmojiPicker from "@/components/EmojiPicker";

interface MessageActionsProps {
    canEdit: boolean;
    canDelete: boolean;
    isEmojiPickerOpen: boolean;
    isPinned?: boolean;
    isBookmarked?: boolean;
    onReply: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onReact: (emoji: string) => void;
    onToggleEmojiPicker: () => void;
    onPin?: () => void;
    onBookmark?: () => void;
}

export default function MessageActions({
    canEdit,
    canDelete,
    isEmojiPickerOpen,
    isPinned,
    isBookmarked,
    onReply,
    onEdit,
    onDelete,
    onReact,
    onToggleEmojiPicker,
    onPin,
    onBookmark
}: MessageActionsProps) {
    return (
        <div className="relative flex items-center rounded border border-gray-200 bg-white shadow-sm">
            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-500 hover:text-black"
                onClick={onReply}
                title="Reply in thread"
            >
                <MessageSquare className="h-4 w-4" />
            </Button>
            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-500 hover:text-black"
                onClick={onToggleEmojiPicker}
                title="Add reaction"
            >
                <Smile className="h-4 w-4" />
            </Button>
            {canEdit && (
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-gray-500 hover:text-black"
                    onClick={onEdit}
                    title="Edit message"
                >
                    <Pencil className="h-4 w-4" />
                </Button>
            )}
            {onPin && (
                <Button
                    variant="ghost"
                    size="icon"
                    className={`h-8 w-8 ${isPinned ? "text-blue-600" : "text-gray-500 hover:text-black"}`}
                    onClick={onPin}
                    title={isPinned ? "Unpin message" : "Pin message"}
                >
                    <Pin className="h-4 w-4" />
                </Button>
            )}
            {onBookmark && (
                <Button
                    variant="ghost"
                    size="icon"
                    className={`h-8 w-8 ${isBookmarked ? "text-blue-600" : "text-gray-500 hover:text-black"}`}
                    onClick={onBookmark}
                    title={isBookmarked ? "Remove bookmark" : "Bookmark message"}
                >
                    <Bookmark className="h-4 w-4" />
                </Button>
            )}
            {canDelete && (
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-gray-500 hover:text-black"
                    onClick={onDelete}
                    title="Delete message"
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            )}
            {isEmojiPickerOpen && (
                <EmojiPicker
                    onSelect={(emoji) => {
                        onReact(emoji);
                        onToggleEmojiPicker();
                    }}
                />
            )}
        </div>
    );
}
