'use client';

import { useCallback, useEffect, useRef } from 'react';

interface AutoSaveOptions<T> {
    /**
     * Unique key for localStorage. Should include post ID for edit pages.
     */
    storageKey: string;

    /**
     * Current form data to save
     */
    data: T;

    /**
     * Debounce interval in milliseconds (default: 2000ms)
     */
    debounceMs?: number;

    /**
     * Whether auto-save is enabled (default: true)
     */
    enabled?: boolean;
}

/**
 * Hook that auto-saves form data to localStorage to protect against
 * browser tab suspension (Chrome Memory Saver) and accidental navigation.
 *
 * Usage:
 * ```tsx
 * const { clearSavedData, hasSavedData, getSavedData } = useBlogAutoSave({
 *   storageKey: 'blog-draft-new',
 *   data: formData,
 * });
 * ```
 */
export function useBlogAutoSave<T>({
    storageKey,
    data,
    debounceMs = 2000,
    enabled = true,
}: AutoSaveOptions<T>) {
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isInitialMount = useRef(true);

    // Debounced save to localStorage
    useEffect(() => {
        if (!enabled) return;

        // Skip initial mount to avoid overwriting with empty data
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }

        // Clear existing timeout
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        // Set new debounced save
        timeoutRef.current = setTimeout(() => {
            try {
                const saveData = {
                    data,
                    savedAt: new Date().toISOString(),
                };
                localStorage.setItem(storageKey, JSON.stringify(saveData));
            } catch (error) {
                // localStorage full or disabled - fail silently
                console.warn('Auto-save failed:', error);
            }
        }, debounceMs);

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [data, storageKey, debounceMs, enabled]);

    // Clear saved data (call after successful save to server)
    const clearSavedData = useCallback(() => {
        try {
            localStorage.removeItem(storageKey);
        } catch {
            // Ignore errors
        }
    }, [storageKey]);

    // Check if there's saved data
    const hasSavedData = useCallback((): boolean => {
        try {
            const saved = localStorage.getItem(storageKey);
            if (!saved) return false;

            const parsed = JSON.parse(saved);

            // Check if saved data is less than 24 hours old
            const savedAt = new Date(parsed.savedAt);
            const now = new Date();
            const hoursDiff =
                (now.getTime() - savedAt.getTime()) / (1000 * 60 * 60);

            return hoursDiff < 24;
        } catch {
            return false;
        }
    }, [storageKey]);

    // Get saved data
    const getSavedData = useCallback((): { data: T; savedAt: Date } | null => {
        try {
            const saved = localStorage.getItem(storageKey);
            if (!saved) return null;

            const parsed = JSON.parse(saved);
            return {
                data: parsed.data as T,
                savedAt: new Date(parsed.savedAt),
            };
        } catch {
            return null;
        }
    }, [storageKey]);

    return {
        clearSavedData,
        hasSavedData,
        getSavedData,
    };
}
