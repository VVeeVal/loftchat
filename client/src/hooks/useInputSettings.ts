import { useCallback, useSyncExternalStore } from 'react';

export type EnterBehavior = 'send' | 'newline';

export interface InputSettings {
    codeBlockEnterPrevents: boolean;
    enterBehavior: EnterBehavior;
}

const STORAGE_KEY = 'loft-input-settings';

const defaultSettings: InputSettings = {
    codeBlockEnterPrevents: false,
    enterBehavior: 'send',
};

let listeners: Set<() => void> = new Set();

function getSnapshot(): InputSettings {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return { ...defaultSettings, ...JSON.parse(stored) };
        }
    } catch {
        // Ignore parse errors
    }
    return defaultSettings;
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function emitChange() {
    listeners.forEach((listener) => listener());
}

export function useInputSettings() {
    const settings = useSyncExternalStore(subscribe, getSnapshot, () => defaultSettings);

    const updateSettings = useCallback((updates: Partial<InputSettings>) => {
        const current = getSnapshot();
        const next = { ...current, ...updates };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        emitChange();
    }, []);

    const setCodeBlockEnterPrevents = useCallback((value: boolean) => {
        updateSettings({ codeBlockEnterPrevents: value });
    }, [updateSettings]);

    const setEnterBehavior = useCallback((value: EnterBehavior) => {
        updateSettings({ enterBehavior: value });
    }, [updateSettings]);

    return {
        settings,
        setCodeBlockEnterPrevents,
        setEnterBehavior,
    };
}
