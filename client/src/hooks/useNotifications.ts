import { useCallback, useEffect, useState } from 'react';

type NotificationPermission = 'granted' | 'denied' | 'default';

const NOTIFICATION_ENABLED_KEY = 'notifications_enabled';
const NOTIFICATION_ENABLED_EVENT = 'loft:notifications-enabled-changed';

function getNotificationPermission(): NotificationPermission {
    if (typeof window !== 'undefined' && 'Notification' in window) {
        return Notification.permission;
    }

    return 'denied';
}

function getStoredNotificationEnabled(): boolean {
    if (typeof window === 'undefined') {
        return true;
    }

    const stored = window.localStorage.getItem(NOTIFICATION_ENABLED_KEY);
    return stored === null ? true : stored === 'true';
}

export function useNotifications() {
    const [permission, setPermission] = useState<NotificationPermission>(getNotificationPermission);

    const [isEnabled, setIsEnabledState] = useState<boolean>(getStoredNotificationEnabled);

    const [isSupported] = useState(() => {
        return typeof window !== 'undefined' && 'Notification' in window;
    });

    // Update permission state when it changes
    useEffect(() => {
        if (!isSupported) return;

        const checkPermission = () => {
            setPermission(Notification.permission);
        };

        // Check periodically (permission can change outside of our control)
        const interval = setInterval(checkPermission, 5000);
        return () => clearInterval(interval);
    }, [isSupported]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const syncEnabledState = () => {
            setIsEnabledState(getStoredNotificationEnabled());
        };

        const handleStorage = (event: StorageEvent) => {
            if (event.key === null || event.key === NOTIFICATION_ENABLED_KEY) {
                syncEnabledState();
            }
        };

        window.addEventListener('storage', handleStorage);
        window.addEventListener(NOTIFICATION_ENABLED_EVENT, syncEnabledState);

        return () => {
            window.removeEventListener('storage', handleStorage);
            window.removeEventListener(NOTIFICATION_ENABLED_EVENT, syncEnabledState);
        };
    }, []);

    const requestPermission = useCallback(async () => {
        if (!isSupported) return 'denied';

        try {
            const result = await Notification.requestPermission();
            setPermission(result);
            return result;
        } catch (error) {
            console.error('Failed to request notification permission:', error);
            return 'denied';
        }
    }, [isSupported]);

    const setEnabled = useCallback((enabled: boolean) => {
        setIsEnabledState(enabled);

        if (typeof window === 'undefined') return;

        window.localStorage.setItem(NOTIFICATION_ENABLED_KEY, String(enabled));
        window.dispatchEvent(new Event(NOTIFICATION_ENABLED_EVENT));
    }, []);

    const showNotification = useCallback((title: string, options?: NotificationOptions & { onClick?: () => void }) => {
        if (!isSupported || permission !== 'granted' || !isEnabled) {
            console.log('[Notifications] Skipped:', { isSupported, permission, isEnabled });
            return null;
        }

        // Only skip if window is focused AND visible (not minimized/hidden)
        if (document.hasFocus() && document.visibilityState === 'visible') {
            console.log('[Notifications] Window focused, skipping notification');
            return null;
        }

        console.log('[Notifications] Showing notification:', title);

        try {
            const notification = new Notification(title, {
                icon: '/loft-icon.svg',
                badge: '/loft-icon.svg',
                ...options,
            });

            if (options?.onClick) {
                notification.onclick = () => {
                    window.focus();
                    options.onClick?.();
                    notification.close();
                };
            }

            // Auto-close after 5 seconds
            setTimeout(() => notification.close(), 5000);

            return notification;
        } catch (error) {
            console.error('Failed to show notification:', error);
            return null;
        }
    }, [isSupported, permission, isEnabled]);

    return {
        isSupported,
        permission,
        isEnabled,
        canNotify: isSupported && permission === 'granted' && isEnabled,
        requestPermission,
        setEnabled,
        showNotification,
    };
}

// Singleton instance for notification management across the app
let notificationCallbacks: Array<(title: string, body: string, onClick?: () => void) => void> = [];

export function registerNotificationHandler(callback: (title: string, body: string, onClick?: () => void) => void) {
    notificationCallbacks.push(callback);
    return () => {
        notificationCallbacks = notificationCallbacks.filter(cb => cb !== callback);
    };
}

export function triggerNotification(title: string, body: string, onClick?: () => void) {
    notificationCallbacks.forEach(callback => callback(title, body, onClick));
}
