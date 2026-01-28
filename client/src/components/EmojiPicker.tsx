import { useMemo } from "react";
import { useCustomEmojis } from "@/hooks/useCustomEmojis";
import { resolveAssetUrl } from "@/lib/assets";

const EMOJIS = ['👍', '👎', '😂', '❤️', '🎉', '😮', '😢', '😡', '🙏', '👀', '🔥', '✅', '💯', '🤔', '👏', '😅'];

interface EmojiPickerProps {
    onSelect: (emoji: string) => void;
}

export default function EmojiPicker({ onSelect }: EmojiPickerProps) {
    const { data: customEmojis = [] } = useCustomEmojis();
    const mappedCustom = useMemo(
        () => customEmojis.map((emoji) => ({ ...emoji, token: `:${emoji.name}:` })),
        [customEmojis]
    );

    return (
        <div className="absolute right-0 top-9 z-20 w-56 rounded-md border border-gray-200 bg-white p-2 shadow-md">
            {mappedCustom.length > 0 && (
                <div className="mb-2 grid grid-cols-8 gap-1">
                    {mappedCustom.map((emoji) => (
                        <button
                            key={emoji.id}
                            type="button"
                            className="flex h-7 w-7 items-center justify-center rounded hover:bg-gray-100"
                            onClick={() => onSelect(emoji.token)}
                            title={emoji.name}
                        >
                            <img
                                src={resolveAssetUrl(emoji.imageUrl)}
                                alt={emoji.name}
                                className="h-4 w-4"
                            />
                        </button>
                    ))}
                </div>
            )}
            <div className="grid grid-cols-8 gap-1">
                {EMOJIS.map((emoji) => (
                    <button
                        key={emoji}
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded hover:bg-gray-100"
                        onClick={() => onSelect(emoji)}
                    >
                        <span className="text-base">{emoji}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}
