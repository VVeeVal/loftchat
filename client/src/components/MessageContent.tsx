import { useCallback, useMemo } from "react";
import type { ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { api } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";

interface Mention {
    user?: {
        id: string;
        name?: string | null;
        email?: string | null;
    };
}

interface MessageContentProps {
    content: string;
    mentions?: Mention[];
    className?: string;
}

const REMARK_PLUGINS = [remarkGfm];
const MENTION_PATTERN = /@([A-Za-z0-9._-]+(?:\s+[A-Za-z0-9._-]+)*)/g;

function renderTextWithMentions(
    text: string,
    mentionMap: Map<string, Mention>,
    onMentionClick: (userId?: string) => void
): ReactNode {
    if (mentionMap.size === 0) {
        return text;
    }

    const parts: ReactNode[] = [];
    let lastIndex = 0;
    for (const match of text.matchAll(MENTION_PATTERN)) {
        const full = match[0];
        const mentionName = match[1]?.toLowerCase() || "";
        const index = match.index ?? 0;

        if (index > lastIndex) {
            parts.push(text.slice(lastIndex, index));
        }

        const mention = mentionMap.get(mentionName);
        if (mention?.user) {
            parts.push(
                <button
                    key={`mention-${index}`}
                    type="button"
                    onClick={() => onMentionClick(mention.user?.id)}
                    className="rounded bg-yellow-100 px-1 text-yellow-800 hover:bg-yellow-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
                >
                    {full}
                </button>
            );
        } else {
            parts.push(full);
        }

        lastIndex = index + full.length;
    }

    if (lastIndex < text.length) {
        parts.push(text.slice(lastIndex));
    }

    return parts.length > 0 ? parts : text;
}

function processChildren(
    children: ReactNode,
    mentionMap: Map<string, Mention>,
    onMentionClick: (userId?: string) => void
): ReactNode {
    if (typeof children === 'string') {
        return renderTextWithMentions(children, mentionMap, onMentionClick);
    }
    if (Array.isArray(children)) {
        return children.map((child, index) =>
            typeof child === 'string'
                ? <span key={index}>{renderTextWithMentions(child, mentionMap, onMentionClick)}</span>
                : child
        );
    }
    return children;
}

function createComponents(
    mentionMap: Map<string, Mention>,
    onMentionClick: (userId?: string) => void,
    className?: string
): Components {
    const withMentions = (children: ReactNode) => processChildren(children, mentionMap, onMentionClick);

    return {
        p: ({ children }) => <p className={className}>{withMentions(children)}</p>,
        strong: ({ children }) => <strong>{withMentions(children)}</strong>,
        em: ({ children }) => <em>{withMentions(children)}</em>,
        li: ({ children }) => <li>{withMentions(children)}</li>,
        h1: ({ children }) => <h1 className="text-xl font-bold">{withMentions(children)}</h1>,
        h2: ({ children }) => <h2 className="text-lg font-bold">{withMentions(children)}</h2>,
        h3: ({ children }) => <h3 className="text-base font-bold">{withMentions(children)}</h3>,
        td: ({ children }) => <td className="border border-gray-300 px-3 py-2">{withMentions(children)}</td>,
        th: ({ children }) => <th className="border border-gray-300 px-3 py-2 text-left font-semibold">{withMentions(children)}</th>,
        blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-gray-300 pl-4 italic text-gray-600">
                {children}
            </blockquote>
        ),
        a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer" className="text-blue-600 underline hover:text-blue-800">
                {children}
            </a>
        ),
        pre: ({ children }) => (
            <pre className="my-2 overflow-x-auto rounded bg-gray-900 p-3 text-sm text-gray-100">
                {children}
            </pre>
        ),
        code: ({ className, children }) => {
            // Fenced code blocks have a className like "language-js"
            const isBlock = Boolean(className);
            if (isBlock) {
                return <code className="whitespace-pre-wrap">{children}</code>;
            }
            return <code className="rounded bg-gray-100 px-1 py-0.5 text-sm">{children}</code>;
        },
        ul: ({ children }) => <ul className="ml-5 list-disc space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="ml-5 list-decimal space-y-1">{children}</ol>,
        table: ({ children }) => (
            <div className="my-2 overflow-x-auto">
                <table className="min-w-full border-collapse border border-gray-300">{children}</table>
            </div>
        ),
        thead: ({ children }) => <thead className="bg-gray-100">{children}</thead>,
        tr: ({ children }) => <tr className="border-b border-gray-300">{children}</tr>,
        hr: () => <hr className="my-4 border-t border-gray-300" />,
    };
}

export default function MessageContent({ content, mentions, className }: MessageContentProps) {
    const navigate = useNavigate();
    const { toast } = useToast();

    const mentionMap = useMemo(() => {
        const map = new Map<string, Mention>();
        (mentions ?? []).forEach((mention) => {
            const name = mention.user?.name?.toLowerCase();
            if (name) {
                map.set(name, mention);
            }
        });
        return map;
    }, [mentions]);

    const mentionMutation = useMutation({
        mutationFn: (targetUserId: string) => api.dms.create(targetUserId),
        onSuccess: (session) => {
            if (session?.id) {
                navigate(`/dms/${session.id}`);
            }
        },
        onError: (error) => {
            toast({
                title: 'Cannot open DM',
                description: error instanceof Error ? error.message : 'Failed to open a direct message',
                variant: 'destructive'
            });
        }
    });

    const handleMentionClick = useCallback((userId?: string) => {
        if (!userId) return;
        mentionMutation.mutate(userId);
    }, [mentionMutation]);

    const components = useMemo(
        () => createComponents(mentionMap, handleMentionClick, className),
        [mentionMap, handleMentionClick, className]
    );

    return (
        <div className="space-y-2 break-words">
            <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={components}>
                {content}
            </ReactMarkdown>
        </div>
    );
}
