import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { resolveAssetUrl } from "@/lib/assets";

interface MentionUser {
    id: string;
    name: string | null;
    email: string;
    image?: string | null;
}

interface MentionAutocompleteProps {
    users: MentionUser[];
    activeIndex: number;
    onSelect: (user: MentionUser) => void;
    onHighlight: (index: number) => void;
}

export default function MentionAutocomplete({
    users,
    activeIndex,
    onSelect,
    onHighlight
}: MentionAutocompleteProps) {
    return (
        <div className="absolute left-0 top-12 z-50 w-64 max-h-60 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-md">
            {users.map((user, index) => {
                const isActive = index === activeIndex;
                return (
                    <button
                        key={user.id}
                        type="button"
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                            isActive ? 'bg-gray-100' : 'hover:bg-gray-50'
                        }`}
                        onMouseEnter={() => onHighlight(index)}
                        onClick={() => onSelect(user)}
                    >
                        <Avatar className="h-6 w-6">
                            <AvatarImage src={resolveAssetUrl(user.image)} />
                            <AvatarFallback>{user.name?.[0] || user.email[0]}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                            <div className="truncate font-semibold">{user.name || user.email}</div>
                            <div className="truncate text-xs text-gray-500">{user.email}</div>
                        </div>
                    </button>
                );
            })}
        </div>
    );
}
