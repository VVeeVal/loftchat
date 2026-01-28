import { usePresence } from '@/contexts/PresenceContext';
import type { PresenceStatus } from '@/contexts/PresenceContext';
import { cn } from '@/lib/utils';

interface PresenceIndicatorProps {
    userId: string;
    className?: string;
    size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
};

const statusColors: Record<PresenceStatus, string> = {
    online: 'bg-green-500',
    away: 'bg-yellow-500',
    offline: 'bg-gray-400',
};

export function PresenceIndicator({ userId, className, size = 'sm' }: PresenceIndicatorProps) {
    const { getPresence } = usePresence();
    const status = getPresence(userId);

    return (
        <div
            className={cn(
                'rounded-full border border-[#3F0E40]',
                sizeClasses[size],
                statusColors[status],
                className
            )}
            title={status.charAt(0).toUpperCase() + status.slice(1)}
        />
    );
}

interface PresenceDotProps {
    status: PresenceStatus;
    className?: string;
    size?: 'sm' | 'md' | 'lg';
}

export function PresenceDot({ status, className, size = 'sm' }: PresenceDotProps) {
    return (
        <div
            className={cn(
                'rounded-full border border-[#3F0E40]',
                sizeClasses[size],
                statusColors[status],
                className
            )}
            title={status.charAt(0).toUpperCase() + status.slice(1)}
        />
    );
}
