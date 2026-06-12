'use client';

import type React from 'react';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react';

export type V2ThemeMode = 'standard' | 'santa';

interface V2ThemeContextType {
  theme: V2ThemeMode;
  setTheme: (theme: V2ThemeMode) => void;
  toggleTheme: () => void;
}

const V2ThemeContext = createContext<V2ThemeContextType | undefined>(undefined);

const THEME_COOKIE_NAME = 'storefront-theme-v2';

/**
 * Helper to get cookie value (client-side only)
 */
function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  // Escape special characters in cookie name to prevent ReDoS
  const safeName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
  const match = document.cookie.match(new RegExp(`(^| )${safeName}=([^;]+)`));
  return match ? match[2] : undefined;
}

/**
 * Helper to set cookie (client-side only)
 * Cookie expires in 30 days
 */
function setCookie(name: string, value: string): void {
  if (typeof document === 'undefined') return;
  const expires = new Date();
  expires.setTime(expires.getTime() + 30 * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
}

/**
 * Cookie/date defaults have no change events; the snapshot only diverges from
 * the server snapshot once, right after hydration, so no subscription is
 * needed. Module scope keeps the subscribe identity stable.
 */
function subscribeToThemeDefaults(): () => void {
  return () => {
    // No external store events to unsubscribe from.
  };
}

/**
 * Resolve the client-side default theme from the current month and cookie.
 * CRITICAL: Always force standard theme outside December so Santa mode is
 * NEVER shown from January onwards.
 */
function resolveClientDefaultTheme(
  initialTheme: V2ThemeMode | undefined
): V2ThemeMode {
  const isDecember = new Date().getMonth() === 11;
  if (!isDecember) {
    return 'standard';
  }

  // In December: Use cookie preference or date-based default
  const cookieTheme = getCookie(THEME_COOKIE_NAME);
  if (cookieTheme === 'standard' || cookieTheme === 'santa') {
    return cookieTheme;
  }

  // If no cookie, use the server-provided theme or santa for December
  return initialTheme ?? 'santa';
}

export const useV2Theme = () => {
  const context = useContext(V2ThemeContext);
  if (!context) {
    throw new Error('useV2Theme must be used within a V2ThemeProvider');
  }
  return context;
};

interface V2ThemeProviderProps {
  children: React.ReactNode;
  /** Initial theme from server (read from cookie) - enables SSR consistency */
  initialTheme?: V2ThemeMode;
}

export const V2ThemeProvider: React.FC<V2ThemeProviderProps> = ({
  children,
  initialTheme,
}) => {
  // Explicit user choice (toggle) wins over the resolved default.
  const [userTheme, setUserTheme] = useState<V2ThemeMode | null>(null);

  // CRITICAL: The server snapshot mirrors the server-provided initialTheme for
  // SSR consistency (default 'standard'); React swaps in the client snapshot
  // (date + cookie based) right after hydration, replacing the previous
  // setState-in-effect sync without an extra stale committed frame.
  const defaultTheme = useSyncExternalStore(
    subscribeToThemeDefaults,
    () => resolveClientDefaultTheme(initialTheme),
    () => initialTheme ?? 'standard'
  );

  const theme = userTheme ?? defaultTheme;

  // Keep the cookie aligned with the date-based default. This only writes to
  // an external system (document.cookie) — no React state updates.
  useEffect(() => {
    const isDecember = new Date().getMonth() === 11;
    const cookieTheme = getCookie(THEME_COOKIE_NAME);

    // CRITICAL FIX: Clear the santa cookie outside December
    // This ensures Santa mode is NEVER shown in January onwards
    if (!isDecember) {
      if (cookieTheme === 'santa') {
        setCookie(THEME_COOKIE_NAME, 'standard');
      }
      return;
    }

    if (cookieTheme === 'standard' || cookieTheme === 'santa') {
      return;
    }

    // If no cookie and no server-provided theme, persist the December default
    if (!initialTheme) {
      setCookie(THEME_COOKIE_NAME, 'santa');
    }
  }, [initialTheme]);

  const setTheme = (newTheme: V2ThemeMode) => {
    setUserTheme(newTheme);
    setCookie(THEME_COOKIE_NAME, newTheme);
  };

  const toggleTheme = () => {
    const newTheme = theme === 'standard' ? 'santa' : 'standard';
    setTheme(newTheme);
  };

  return (
    <V2ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </V2ThemeContext.Provider>
  );
};
