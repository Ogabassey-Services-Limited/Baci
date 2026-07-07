import type { Session, User } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { getClearedAuthState, getSessionAuthState } from './commit-auth-state';

function createSession(): Session {
  const user: User = {
    app_metadata: {},
    aud: 'authenticated',
    created_at: '2026-07-06T00:00:00.000Z',
    id: 'user-1',
    user_metadata: {},
  };

  return {
    access_token: 'access-token',
    expires_at: 1_900_000_000,
    expires_in: 3600,
    refresh_token: 'refresh-token',
    token_type: 'bearer',
    user,
  };
}

describe('auth state commit helpers', () => {
  it('maps a session to authenticated store state', () => {
    const session = createSession();

    expect(getSessionAuthState(session)).toEqual({
      activeAuthProvider: null,
      isAuthenticated: true,
      isAuthenticating: false,
      isInitialized: true,
      isLoading: false,
      session,
      user: session.user,
    });
  });

  it('maps cleared auth state consistently', () => {
    expect(getClearedAuthState()).toEqual({
      activeAuthProvider: null,
      isAuthenticated: false,
      isAuthenticating: false,
      isInitialized: true,
      isLoading: false,
      session: null,
      user: null,
    });
  });
});
