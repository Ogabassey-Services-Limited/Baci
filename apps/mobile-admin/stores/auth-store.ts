/**
 * Auth Store — Single source of truth for authentication state
 *
 * Replaces the per-component useAuth hook to avoid duplicate
 * onAuthStateChange subscriptions (one per call site).
 * Now there is exactly ONE listener, managed by initialize().
 */

import type { AuthError, Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';
import { clearAdminQueryCache } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';
import { useRevenueCatStore } from '@/stores/revenueCatStore';

interface AuthState {
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
  ) => Promise<{ error: AuthError | null }>;
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

export const useAuthStore = create<AuthStore>((set, get) => ({
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
          set({
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
        void resetUserStores();
      }

      set({
        session,
        user: session?.user ?? null,
        isAuthenticated: !!session,
        isLoading: false,
      });
    });

    return () => subscription.unsubscribe();
  },

  signIn: async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
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
}));
