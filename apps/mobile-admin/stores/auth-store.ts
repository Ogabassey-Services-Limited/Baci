/**
 * Auth Store — Single source of truth for authentication state
 *
 * Replaces the per-component useAuth hook to avoid duplicate
 * onAuthStateChange subscriptions (one per call site).
 * Now there is exactly ONE listener, managed by initialize().
 */

import type { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';
import {
  runSocialSignIn,
  type SocialAuthProvider,
} from '@/lib/auth/social-auth-helper';
import { clearAdminQueryCache } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';
import { trackAuthTelemetry } from '@/services/auth-telemetry';
import { useRevenueCatStore } from '@/stores/revenueCatStore';

type AuthProvider = 'password' | SocialAuthProvider;

interface AuthState {
  activeAuthProvider: AuthProvider | null;
  isAuthenticating: boolean;
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** True after the initial getUser() check has resolved */
  isInitialized: boolean;
}

interface AuthActions {
  initialize: () => () => void;
  signIn: (
    email: string,
    password: string
  ) => Promise<{ cancelled?: boolean; error: string | null }>;
  signInWithApple: () => Promise<{ cancelled?: boolean; error: string | null }>;
  signInWithGoogle: () => Promise<{ cancelled?: boolean; error: string | null }>;
  signOut: (onBeforeSignOut?: () => Promise<void>) => Promise<void>;
}

export type AuthStore = AuthState & AuthActions;

/**
 * Resets user-specific stores to prevent cross-user data bleed.
 * Called on SIGNED_IN events and during signOut.
 */
async function resetUserStores(): Promise<void> {
  clearAdminQueryCache();
  useRevenueCatStore.getState().cleanup();
  const { useSettingsStore } = await import('@/hooks/useSettingsStore');
  useSettingsStore.getState().reset();
}

export const useAuthStore = create<AuthStore>((set, get) => {
  return {
    activeAuthProvider: null,
    isAuthenticating: false,
    user: null,
    session: null,
    isLoading: true,
    isAuthenticated: false,
    isInitialized: false,

    initialize: () => {
      // Validate auth with server (getSession only reads local JWT, which could be stale/tampered)
      supabase.auth
        .getUser()
        .then(({ data: { user }, error }) => {
          if (error || !user) {
            // If we have a refresh token error, the session is dead. Clear it.
            // This prevents the "Invalid Refresh Token" loop.
            if (
              error?.message.includes('Refresh Token') ||
              error?.message.includes('invalid_grant')
            ) {
              console.warn(
                '[AuthStore] Invalid refresh token detected, forcing sign out'
              );
              get().signOut();
            }

            set({
              activeAuthProvider: null,
              isAuthenticating: false,
              session: null,
              user: null,
              isLoading: false,
              isAuthenticated: false,
              isInitialized: true,
            });
          } else {
            set({ user });
            // Also fetch session for token access after server validation
            supabase.auth
              .getSession()
              .then(({ data: { session } }) => {
                set({
                  session,
                  isAuthenticated: !!session,
                  isLoading: false,
                  isInitialized: true,
                });
              })
              .catch(() => {
                // Session fetch failed but we have a valid user — mark as initialized
                set({ isLoading: false, isInitialized: true });
              });
          }
        })
        .catch(() => {
          // Network error on getUser — stop loading spinner so the app is usable
          set({
            activeAuthProvider: null,
            isAuthenticating: false,
            session: null,
            user: null,
            isLoading: false,
            isAuthenticated: false,
            isInitialized: true,
          });
        });

      // Single listener for the entire app
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        // Don't update state from the listener until after the initial getUser() completes.
        // This prevents INITIAL_SESSION from setting auth state before server validation.
        if (!get().isInitialized) {
          return;
        }

        // On SIGNED_IN, reset user-specific stores to prevent cross-user data bleed
        if (event === 'SIGNED_IN') {
          const currentUserId = get().user?.id;
          const nextUserId = session?.user?.id;

          if (nextUserId && currentUserId !== nextUserId) {
            void resetUserStores();
          }
        } else if (event === 'SIGNED_OUT') {
          void resetUserStores();
        }

        // 2026 Critical Fix: On SIGNED_OUT (session expiry), reset stores to prevent stale data
        if (event === 'SIGNED_OUT' && get().user) {
          void resetUserStores();
        }

        set({
          activeAuthProvider: null,
          isAuthenticating: false,
          session,
          user: session?.user ?? null,
          isAuthenticated: !!session,
          isLoading: false,
        });
      });

      return () => subscription.unsubscribe();
    },

    signIn: async (email: string, password: string) => {
      const startedAt = Date.now();
      set({ activeAuthProvider: 'password', isAuthenticating: true });
      trackAuthTelemetry({
        provider: 'password',
        stage: 'start',
      });

      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          trackAuthTelemetry({
            code: 'password_invalid_credentials',
            durationMs: Date.now() - startedAt,
            metadata: {
              hasSession: Boolean(data.session),
            },
            provider: 'password',
            stage: 'failure',
          });
          return { error: error.message };
        }

        if (data.session && data.user) {
          const currentUserId = get().user?.id;
          set({
            session: data.session,
            user: data.user,
            isAuthenticated: true,
            isInitialized: true,
            isLoading: false,
          });

          if (currentUserId !== data.user.id) {
            void resetUserStores();
          }
        }

        trackAuthTelemetry({
          durationMs: Date.now() - startedAt,
          metadata: {
            hasSession: Boolean(data.session),
            hasUser: Boolean(data.user),
          },
          provider: 'password',
          stage: 'success',
        });

        return { error: null };
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Password sign-in failed. Please try again.';

        trackAuthTelemetry({
          code: 'password_unknown_error',
          durationMs: Date.now() - startedAt,
          provider: 'password',
          stage: 'failure',
        });

        return { error: message };
      } finally {
        set({ activeAuthProvider: null, isAuthenticating: false });
      }
    },

    signInWithGoogle: async () => {
      return runSocialSignIn('google', {
        getCurrentUserId: () => get().user?.id,
        nativeSignIn: async () => {
          const { signInWithGoogleNative } = await import(
            '@/lib/auth/sign-in-with-google'
          );
          return signInWithGoogleNative();
        },
        onResetUserStores: () => resetUserStores(),
        setState: (state) => set(state),
      });
    },

    signInWithApple: async () => {
      return runSocialSignIn('apple', {
        getCurrentUserId: () => get().user?.id,
        nativeSignIn: async () => {
          const { signInWithAppleNative } = await import(
            '@/lib/auth/sign-in-with-apple'
          );
          return signInWithAppleNative();
        },
        onResetUserStores: () => resetUserStores(),
        setState: (state) => set(state),
      });
    },

    signOut: async (onBeforeSignOut?: () => Promise<void>) => {
      // Run caller-provided cleanup (e.g. push notification unregistration)
      if (onBeforeSignOut) {
        try {
          await onBeforeSignOut();
        } catch (error) {
          console.error('[AuthStore] onBeforeSignOut callback failed:', error);
        }
      }
      // Reset all user-specific caches and stores
      await resetUserStores();
      await supabase.auth.signOut();
    },
  };
});
