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

const THEME_COOKIE_NAME = 'storefront-theme';

/**
 * Helper to get cookie value (client-side only)
 * Uses split-based parsing instead of regex to prevent ReDoS vulnerabilities
 */
function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [key, ...valueParts] = cookie.split('=');
    if (key?.trim() === name) {
      return valueParts.join('='); // Handle values containing '='
    }
  }
  return undefined;
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
  // Default to 'standard' if not provided - this ensures consistent hydration.
  // The date-based logic is deferred to useEffect to avoid Date() mismatch.
  const [theme, setThemeState] = useState<V2ThemeMode>(
    initialTheme ?? 'standard'
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

    // If no cookie and no server-provided theme, use date-based default
    if (!initialTheme) {
      const isDecember = new Date().getMonth() === 11;
      const dateBasedTheme: V2ThemeMode = isDecember ? 'santa' : 'standard';
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
