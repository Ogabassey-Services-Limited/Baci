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

import {
  type Href,
  router,
  usePathname,
  useRootNavigationState,
  useSegments,
} from 'expo-router';
import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { createLogger } from '@/lib/logger';
import { useAuthStore } from '@/stores/auth-store';

const log = createLogger('AuthGuard');

// Routes that require authentication
const PROTECTED_ROUTES = [
  'account',
  'orders',
  'addresses',
  'wallet',
  'profile',
  'receipts',
] as const;

/**
 * Hook to guard routes and handle auth state changes
 * Should be called in the root layout
 */
export function useAuthGuard() {
  const { user, isInitialized } = useAuthStore(
    useShallow((state) => ({
      user: state.user,
      isInitialized: state.isInitialized,
    }))
  );
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  const previousUser = useRef(user);

  useEffect(() => {
    // isMounted guards against stale closures if async operations are added
    // in the future. Currently all operations are synchronous, so this is
    // defensive/future-proofing.
    let isMounted = true;

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

      if (isOnProtectedRoute && isMounted) {
        // Redirect to home tab
        router.replace('/');
      }
    }

    // Update ref for next comparison
    previousUser.current = user;

    return () => {
      isMounted = false;
    };
    // Bug #8 fix: Use navigationState directly (not ?.key) to ensure the effect
    // runs reliably on mount even when key is initially undefined
  }, [user, isInitialized, segments, navigationState]);

  return {
    isAuthenticated: user !== null,
    isInitialized,
  };
}

/**
 * Hook to protect a specific screen — declarative pattern.
 *
 * 2026 Best Practice (Expo Router):
 * Instead of imperatively calling router.push inside a useEffect (race-prone),
 * this hook returns `redirectTo` — a typed href the screen should render as
 * `<Redirect href={redirectTo} />`. This is idempotent, declarative, and
 * naturally deduplicates across multiple mounted screens.
 *
 * Usage:
 * ```tsx
 * const { isLoading, isAuthenticated, redirectTo } = useRequireAuth();
 * if (isLoading || redirectTo) {
 *   return redirectTo
 *     ? <Redirect href={redirectTo} />
 *     : <ActivityIndicator />;
 * }
 * ```
 */
export function useRequireAuth() {
  const { user, isInitialized } = useAuthStore(
    useShallow((state) => ({
      user: state.user,
      isInitialized: state.isInitialized,
    }))
  );
  const pathname = usePathname();

  const isAuthenticated = user !== null;
  const isLoading = !isInitialized;

  // Build the redirect href declaratively — no useEffect needed
  let redirectTo: Href | null = null;
  if (isInitialized && !isAuthenticated) {
    const returnTo = encodeURIComponent(pathname);
    redirectTo = `/auth/login?returnTo=${returnTo}` as Href;
  }

  return {
    isAuthenticated,
    isLoading,
    redirectTo,
    user,
  };
}

/**
 * Hook to check auth status without redirecting
 * Useful for conditional UI rendering
 */
export function useAuthStatus() {
  const { user, customer, merchantId, isInitialized, isLoading } = useAuthStore(
    useShallow((state) => ({
      user: state.user,
      customer: state.customer,
      merchantId: state.merchantId,
      isInitialized: state.isInitialized,
      isLoading: state.isLoading,
    }))
  );

  return {
    isAuthenticated: user !== null,
    isGuest: user === null,
    isInitialized,
    isLoading,
    merchantId,
    user,
    customer,
  };
}
