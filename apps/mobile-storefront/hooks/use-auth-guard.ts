/**
 * Auth Guard Hook
 *
 * 2026 Best Practices:
 * - Listens for auth state changes and handles navigation
 * - Redirects to home when user signs out
 * - Protects routes that require authentication
 * - Prevents accessing protected screens with stale data
 *
 * @see https://www.esparkinfo.com/blog/react-native-best-practices
 */

import { router, type Href, useSegments, useRootNavigationState } from 'expo-router';
import { useEffect, useRef } from 'react';
import { createLogger } from '@/lib/logger';
import { useAuthStore } from '@/stores/auth-store';

const log = createLogger('AuthGuard');

// Routes that require authentication
const PROTECTED_ROUTES = [
  'orders',
  'addresses',
  'wallet',
  'profile',
] as const;

/**
 * Hook to guard routes and handle auth state changes
 * Should be called in the root layout
 */
export function useAuthGuard() {
  const user = useAuthStore((state) => state.user);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  const previousUser = useRef(user);

  useEffect(() => {
    // Wait for auth to initialize and navigation to be ready
    if (!isInitialized || !navigationState?.key) {
      return;
    }

    const currentSegment = segments[0] || '';
    const wasSignedIn = previousUser.current !== null;
    const isSignedIn = user !== null;

    // Detect sign out: was signed in, now not signed in
    if (wasSignedIn && !isSignedIn) {
      log.info('User signed out - redirecting to home');

      // Check if currently on a protected route
      const isOnProtectedRoute = PROTECTED_ROUTES.some(
        (route) => currentSegment === route || segments.includes(route as never)
      );

      if (isOnProtectedRoute) {
        // Redirect to home tab
        router.replace('/(tabs)');
      }
    }

    // Update ref for next comparison
    previousUser.current = user;
  }, [user, isInitialized, segments, navigationState?.key]);

  return {
    isAuthenticated: user !== null,
    isInitialized,
  };
}

/**
 * Hook to protect a specific screen
 * Redirects to login if not authenticated
 * Use this on screens that require auth
 */
export function useRequireAuth(options?: { redirectTo?: string }) {
  const user = useAuthStore((state) => state.user);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const navigationState = useRootNavigationState();

  useEffect(() => {
    // Wait for auth to initialize and navigation to be ready
    if (!isInitialized || !navigationState?.key) {
      return;
    }

    // If not authenticated, redirect to login
    if (!user) {
      const redirectPath = (options?.redirectTo || '/auth/login') as Href;
      router.replace(redirectPath);
    }
  }, [user, isInitialized, navigationState?.key, options?.redirectTo]);

  return {
    isAuthenticated: user !== null,
    isLoading: !isInitialized,
    user,
  };
}

/**
 * Hook to check auth status without redirecting
 * Useful for conditional UI rendering
 */
export function useAuthStatus() {
  const user = useAuthStore((state) => state.user);
  const customer = useAuthStore((state) => state.customer);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const isLoading = useAuthStore((state) => state.isLoading);

  return {
    isAuthenticated: user !== null,
    isGuest: user === null,
    isInitialized,
    isLoading,
    user,
    customer,
  };
}
