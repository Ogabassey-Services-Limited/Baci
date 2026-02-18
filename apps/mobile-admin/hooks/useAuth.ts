/**
 * useAuth Hook — Thin wrapper around the Zustand auth store
 *
 * All auth state and logic lives in stores/auth-store.ts.
 * This wrapper preserves the existing API so all 21+ call sites
 * continue to work without changes.
 */

import type { AuthError, Session, User } from '@supabase/supabase-js';
import { useShallow } from 'zustand/shallow';
import { useAuthStore } from '@/stores/auth-store';

export interface UseAuthReturn {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (
    email: string,
    password: string
  ) => Promise<{ error: AuthError | null }>;
  signOut: (onBeforeSignOut?: () => Promise<void>) => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  return useAuthStore(
    useShallow((state) => ({
      user: state.user,
      session: state.session,
      isLoading: state.isLoading,
      isAuthenticated: state.isAuthenticated,
      signIn: state.signIn,
      signOut: state.signOut,
    }))
  );
}
