'use client';

import type React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';

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
  // CRITICAL: Use server-provided initialTheme for SSR consistency.
  // Default to 'standard' - Santa mode can be toggled manually.
  const [theme, setThemeState] = useState<V2ThemeMode>(
    initialTheme ?? 'standard'
  );

  // On mount (client-side only), apply date-based default or cookie preference
  // This runs AFTER hydration to avoid mismatch
  useEffect(() => {
    // Automatic festive mode check
    const currentMonth = new Date().getMonth();
    const isDecember = currentMonth === 11;

    // CRITICAL FIX: Always force standard theme outside December
    // This ensures Santa mode is NEVER shown in January onwards
    if (!isDecember) {
      // Always set to standard if it's not December
      if (theme !== 'standard') {
        setThemeState('standard');
      }
      // Clear the santa cookie if it exists
      const cookieTheme = getCookie(THEME_COOKIE_NAME);
      if (cookieTheme === 'santa') {
        setCookie(THEME_COOKIE_NAME, 'standard');
      }
      return;
    }

    // In December: Use cookie preference or date-based default
    const cookieTheme = getCookie(THEME_COOKIE_NAME) as V2ThemeMode | undefined;

    if (cookieTheme && (cookieTheme === 'standard' || cookieTheme === 'santa')) {
      if (cookieTheme !== theme) {
        setThemeState(cookieTheme);
      }
      return;
    }

    // If no cookie and no server-provided theme, use santa for December
    if (!initialTheme) {
      if (theme !== 'santa') {
        setThemeState('santa');
        setCookie(THEME_COOKIE_NAME, 'santa');
      }
    }
  }, []); // Only run once on mount

  const setTheme = (newTheme: V2ThemeMode) => {
    setThemeState(newTheme);
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
