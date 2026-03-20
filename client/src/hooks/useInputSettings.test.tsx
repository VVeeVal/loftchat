import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useInputSettings } from './useInputSettings';

const STORAGE_KEY = 'loft-input-settings';

describe('useInputSettings', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('returns a stable snapshot across rerenders without changing values', () => {
        const { result, rerender } = renderHook(() => useInputSettings());
        const firstSettings = result.current.settings;

        rerender();

        expect(result.current.settings).toBe(firstSettings);
    });

    it('updates the cached snapshot when enter behavior changes', () => {
        const { result } = renderHook(() => useInputSettings());

        act(() => {
            result.current.setEnterBehavior('send');
        });

        expect(result.current.settings.enterBehavior).toBe('send');
        expect(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')).toMatchObject({
            enterBehavior: 'send',
        });
    });
});
