import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export function useCustomEmojis(enabled = true) {
    return useQuery({
        queryKey: ['custom-emoji'],
        queryFn: () => api.emoji.list(),
        enabled
    });
}
