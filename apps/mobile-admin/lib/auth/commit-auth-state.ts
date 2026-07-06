import type { Session, User } from '@supabase/supabase-js';

export type AuthStatePatch = {
  activeAuthProvider: null;
  isAuthenticated: boolean;
  isAuthenticating: false;
  isInitialized: true;
  isLoading: false;
  session: Session | null;
  user: User | null;
};

export function getSessionAuthState(session: Session): AuthStatePatch {
  return {
    activeAuthProvider: null,
    isAuthenticated: true,
    isAuthenticating: false,
    isInitialized: true,
    isLoading: false,
    session,
    user: session.user,
  };
}

export function getClearedAuthState(): AuthStatePatch {
  return {
    activeAuthProvider: null,
    isAuthenticated: false,
    isAuthenticating: false,
    isInitialized: true,
    isLoading: false,
    session: null,
    user: null,
  };
}
