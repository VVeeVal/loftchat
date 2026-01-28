import { useMemo } from "react";
import { useCustomEmojis } from "@/hooks/useCustomEmojis";
import { resolveAssetUrl } from "@/lib/assets";

interface ReactionUser {
    id: string;
    name: string | null;
}

interface Reaction {
    emoji: string;
    count: number;
    users: ReactionUser[];
}

interface ReactionDisplayProps {
    reactions: Reaction[];
    currentUserId?: string;
    onToggle?: (emoji: string) => void;
}

export default function ReactionDisplay({ reactions, currentUserId, onToggle }: ReactionDisplayProps) {
    if (!reactions || reactions.length === 0) return null;

    const { data: customEmojis = [] } = useCustomEmojis();
    const customEmojiMap = useMemo(() => {
        const map = new Map<string, string>();
        for (const emoji of customEmojis) {
            map.set(emoji.name, resolveAssetUrl(emoji.imageUrl));
        }
        return map;
    }, [customEmojis]);

    const renderEmoji = (value: string) => {
        const match = value.match(/^:([a-zA-Z0-9_+-]+):$/);
        if (match) {
            const imageUrl = customEmojiMap.get(match[1]);
            if (imageUrl) {
                return <img src={imageUrl} alt={match[1]} className="h-4 w-4" />;
            }
        }
        return <span className="text-sm">{value}</span>;
    };

    return (
        <div className="mt-2 flex flex-wrap gap-2">
            {reactions.map((reaction) => {
                const reactedByMe = currentUserId
                    ? reaction.users.some((user) => user.id === currentUserId)
                    : false;
                const tooltip = reaction.users.map((user) => user.name).filter(Boolean).join(', ');

                return (
                    <button
                        key={reaction.emoji}
                        type="button"
                        title={tooltip}
                        className={`flex items-center gap-1 rounded-full border px-2 py-1 text-xs transition-colors ${
                            reactedByMe
                                ? 'border-blue-300 bg-blue-50 text-blue-700'
                                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                        onClick={() => onToggle?.(reaction.emoji)}
                    >
                        {renderEmoji(reaction.emoji)}
                        <span className="font-semibold">{reaction.count}</span>
                    </button>
                );
            })}
        </div>
    );
}
