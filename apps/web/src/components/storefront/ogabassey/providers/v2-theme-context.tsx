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
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
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
  // Default to 'santa' as requested by user.
  const [theme, setThemeState] = useState<V2ThemeMode>(
    initialTheme ?? 'santa'
  );

  // Track if we've completed hydration
  const [isHydrated, setIsHydrated] = useState(false);

  // On mount (client-side only), apply date-based default or cookie preference
  // This runs AFTER hydration to avoid mismatch
  useEffect(() => {
    setIsHydrated(true);

    // First check for user's cookie preference
    const cookieTheme = getCookie(THEME_COOKIE_NAME) as V2ThemeMode | undefined;
    if (cookieTheme && (cookieTheme === 'standard' || cookieTheme === 'santa')) {
      if (cookieTheme !== theme) {
        setThemeState(cookieTheme);
      }
      return;
    }

    // If no cookie and no server-provided theme, use forced default
    if (!initialTheme) {
      // Force Santa mode by default
      const dateBasedTheme: V2ThemeMode = 'santa';
      if (dateBasedTheme !== theme) {
        setThemeState(dateBasedTheme);
        setCookie(THEME_COOKIE_NAME, dateBasedTheme);
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
