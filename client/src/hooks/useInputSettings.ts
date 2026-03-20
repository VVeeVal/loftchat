import { useCallback, useSyncExternalStore } from 'react';

export type EnterBehavior = 'send' | 'newline';

export interface InputSettings {
    codeBlockEnterPrevents: boolean;
    enterBehavior: EnterBehavior;
}

const STORAGE_KEY = 'loft-input-settings';

const defaultSettings: InputSettings = {
    codeBlockEnterPrevents: false,
    enterBehavior: 'newline',
};

let listeners: Set<() => void> = new Set();
let cachedSettings: InputSettings = defaultSettings;
let hasLoadedFromStorage = false;

function parseStoredSettings(stored: string | null): InputSettings {
    if (!stored) {
        return defaultSettings;
    }

    try {
        return { ...defaultSettings, ...JSON.parse(stored) };
    } catch {
        return defaultSettings;
    }
}

function getSnapshot(): InputSettings {
    if (!hasLoadedFromStorage && typeof window !== 'undefined') {
        cachedSettings = parseStoredSettings(localStorage.getItem(STORAGE_KEY));
        hasLoadedFromStorage = true;
    }

    return cachedSettings;
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
        cachedSettings = next;
        hasLoadedFromStorage = true;
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
