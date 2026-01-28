import { AUTH_BASE_URL } from "@/lib/api-client";

export const resolveAssetUrl = (url?: string | null) => {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `${AUTH_BASE_URL}${url}`;
};
