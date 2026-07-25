import * as NavigationBar from 'expo-navigation-bar';
import { useEffect } from 'react';
import { isRuntimePlatform } from '@/config/runtime-platform';

/**
 * Forces the Android navigation bar to light icons while a dark-on-purpose
 * screen is mounted, restoring the theme-driven style on unmount.
 *
 * The auth screens paint their own dark gradient regardless of the system
 * colour scheme, so without this the navigation bar keeps light-theme icons and
 * disappears against the background. No-op off Android.
 *
 * (`app/(auth)/onboarding.tsx` still inlines the same effect; it can adopt this
 * hook when it is next touched.)
 */
export function useLightNavigationBar(isDark: boolean): void {
  useEffect(() => {
    if (!isRuntimePlatform('android')) {
      return;
    }

    void NavigationBar.setStyle('light');
    return () => {
      void NavigationBar.setStyle(isDark ? 'light' : 'dark');
    };
  }, [isDark]);
}
