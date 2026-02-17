'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Custom hook for state that persists to sessionStorage.
 * 2025 best practices:
 * - Lazy initialization from storage (no hydration mismatch)
 * - Debounced writes to avoid performance issues
 * - Proper cleanup and error handling
 * - Type-safe with generics
 */
export function usePersistedState<T>(
  key: string,
  initialValue: T,
  options: {
    /** Debounce delay in ms (default: 300) */
    debounceMs?: number;
    /** Storage type (default: sessionStorage) */
    storage?: 'session' | 'local';
  } = {}
): [T, React.Dispatch<React.SetStateAction<T>>, () => void] {
  const { debounceMs = 300, storage = 'session' } = options;

  // Use lazy initialization to read from storage only once
  const [state, setState] = useState<T>(() => {
    // Always return initialValue on server (SSR safety)
    if (typeof window === 'undefined') return initialValue;

    try {
      const storageApi = storage === 'local' ? localStorage : sessionStorage;
      const stored = storageApi.getItem(key);
      if (stored) {
        return JSON.parse(stored) as T;
      }
    } catch {
      // Storage access failed, use initial value
    }
    return initialValue;
  });

  // Ref to track the debounce timer
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Track if component is mounted (for cleanup)
  const mountedRef = useRef(true);

  // Persist to storage with debouncing
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Clear any existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Debounce the write
    timerRef.current = setTimeout(() => {
      if (!mountedRef.current) return;

      try {
        const storageApi = storage === 'local' ? localStorage : sessionStorage;
        storageApi.setItem(key, JSON.stringify(state));
      } catch {
        // Storage write failed (quota exceeded, private browsing, etc.)
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [state, key, debounceMs, storage]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Clear function to remove from storage
  const clear = () => {
    if (typeof window === 'undefined') return;
    try {
      const storageApi = storage === 'local' ? localStorage : sessionStorage;
      storageApi.removeItem(key);
    } catch {
      // Ignore errors
    }
    setState(initialValue);
  };

  return [state, setState, clear];
}

/**
 * Hook for persisting multiple related form fields as a single object.
 * More efficient than multiple usePersistedState calls.
 */
export function usePersistedForm<T extends Record<string, unknown>>(
  key: string,
  initialValues: T,
  options: {
    debounceMs?: number;
    storage?: 'session' | 'local';
  } = {}
): {
  values: T;
  setValue: <K extends keyof T>(field: K, value: T[K]) => void;
  setValues: (updates: Partial<T>) => void;
  reset: () => void;
  clear: () => void;
} {
  const [values, setValuesState, clear] = usePersistedState<T>(
    key,
    initialValues,
    options
  );

  const setValue = <K extends keyof T>(field: K, value: T[K]) => {
    setValuesState((prev) => ({ ...prev, [field]: value }));
  };

  const setValues = (updates: Partial<T>) => {
    setValuesState((prev) => ({ ...prev, ...updates }));
  };

  const reset = () => {
    setValuesState(initialValues);
  };

  return { values, setValue, setValues, reset, clear };
}
