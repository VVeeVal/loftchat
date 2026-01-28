import { useEffect, useState } from "react";
import { AUTH_BASE_URL } from "@/lib/api-client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ZoomIn, ZoomOut, RefreshCw } from "lucide-react";
import type { Attachment } from "@/types/api";

interface AttachmentListProps {
    attachments?: Attachment[];
}

const formatBytes = (size: number) => {
    if (!size) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const index = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
    const value = size / Math.pow(1024, index);
    return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
};

const getAttachmentUrl = (url: string) => {
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `${AUTH_BASE_URL}${url}`;
};

export default function AttachmentList({ attachments }: AttachmentListProps) {
    if (!attachments || attachments.length === 0) return null;
    const [activeImage, setActiveImage] = useState<{ src: string; alt: string; filename: string } | null>(null);
    const [zoom, setZoom] = useState(1);

    useEffect(() => {
        if (activeImage) {
            setZoom(1);
        }
    }, [activeImage]);

    const clampZoom = (next: number) => Math.min(3, Math.max(0.5, next));

    return (
        <>
            <div className="mt-2 flex flex-wrap gap-3">
                {attachments.map((attachment) => {
                    const href = getAttachmentUrl(attachment.url);
                    const isImage = attachment.mimetype?.startsWith("image/");

                    if (isImage) {
                        return (
                            <button
                                key={attachment.url}
                                type="button"
                                className="group block"
                                onClick={() => setActiveImage({ src: href, alt: attachment.filename, filename: attachment.filename })}
                            >
                                <img
                                    src={href}
                                    alt={attachment.filename}
                                    className="h-36 w-36 rounded-lg border border-gray-200 object-cover shadow-sm transition-transform group-hover:scale-[1.02]"
                                />
                            </button>
                        );
                    }

                    return (
                        <a
                            key={attachment.url}
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 hover:border-gray-300"
                        >
                            <span className="truncate max-w-[200px]">{attachment.filename}</span>
                            <span className="text-gray-400">{formatBytes(attachment.size)}</span>
                        </a>
                    );
                })}
            </div>

            <Dialog open={!!activeImage} onOpenChange={(open) => !open && setActiveImage(null)}>
                <DialogContent className="max-w-5xl p-0 overflow-hidden bg-black/90 border-0">
                    {activeImage && (
                        <div className="absolute left-3 top-3 z-10 flex items-center gap-2 rounded-full bg-black/60 p-1">
                            <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-white hover:bg-white/10"
                                onClick={() => setZoom((z) => clampZoom(z - 0.25))}
                            >
                                <ZoomOut className="h-4 w-4" />
                            </Button>
                            <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-white hover:bg-white/10"
                                onClick={() => setZoom((z) => clampZoom(z + 0.25))}
                            >
                                <ZoomIn className="h-4 w-4" />
                            </Button>
                            <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-white hover:bg-white/10"
                                onClick={() => setZoom(1)}
                            >
                                <RefreshCw className="h-4 w-4" />
                            </Button>
                            <a
                                href={activeImage.src}
                                download={activeImage.filename || "image"}
                                className="inline-flex"
                            >
                                <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-white hover:bg-white/10"
                                >
                                    <Download className="h-4 w-4" />
                                </Button>
                            </a>
                            <span className="ml-1 text-xs text-white/80">{Math.round(zoom * 100)}%</span>
                        </div>
                    )}
                    {activeImage && (
                        <div className="flex h-[80vh] items-center justify-center">
                            <img
                                src={activeImage.src}
                                alt={activeImage.alt}
                                style={{ transform: `scale(${zoom})` }}
                                className="max-h-[80vh] w-auto max-w-full mx-auto transition-transform"
                            />
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
