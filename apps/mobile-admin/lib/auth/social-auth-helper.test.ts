import type { Session, User } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runSocialSignIn } from './social-auth-helper';

const mocks = vi.hoisted(() => ({
  trackAuthTelemetry: vi.fn(),
}));

vi.mock('@/services/auth-telemetry', () => ({
  trackAuthTelemetry: mocks.trackAuthTelemetry,
}));

function createSession(): Session {
  const user: User = {
    app_metadata: {
      provider: 'google',
      providers: ['google'],
    },
    aud: 'authenticated',
    created_at: '2026-03-24T00:00:00.000Z',
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

describe('runSocialSignIn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('commits the social session and resets user stores when the user changes', async () => {
    const session = createSession();
    const setState = vi.fn();
    const onResetUserStores = vi.fn();

    const result = await runSocialSignIn('google', {
      getCurrentUserId: () => 'other-user',
      nativeSignIn: () =>
        Promise.resolve({
          error: null,
          session,
          user: session.user,
        }),
      onResetUserStores,
      setState,
    });

    expect(result).toEqual({ error: null });
    expect(setState).toHaveBeenNthCalledWith(1, {
      activeAuthProvider: 'google',
      isAuthenticating: true,
    });
    expect(setState).toHaveBeenNthCalledWith(2, {
      isAuthenticated: true,
      isInitialized: true,
      isLoading: false,
      session,
      user: session.user,
    });
    expect(setState).toHaveBeenLastCalledWith({
      activeAuthProvider: null,
      isAuthenticating: false,
    });
    expect(onResetUserStores).toHaveBeenCalledTimes(1);
    expect(mocks.trackAuthTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'google',
        stage: 'success',
      })
    );
  });

  it('returns a cancelled result without setting authenticated state', async () => {
    const setState = vi.fn();

    const result = await runSocialSignIn('apple', {
      getCurrentUserId: () => undefined,
      nativeSignIn: () =>
        Promise.resolve({
          cancelled: true,
          code: 'apple_user_cancelled',
          error: null,
          session: null,
          user: null,
        }),
      onResetUserStores: vi.fn(),
      setState,
    });

    expect(result).toEqual({ cancelled: true, error: null });
    expect(setState).toHaveBeenNthCalledWith(1, {
      activeAuthProvider: 'apple',
      isAuthenticating: true,
    });
    expect(setState).toHaveBeenLastCalledWith({
      activeAuthProvider: null,
      isAuthenticating: false,
    });
    expect(mocks.trackAuthTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'apple_user_cancelled',
        provider: 'apple',
        stage: 'cancel',
      })
    );
  });

  it('falls back to the provider error message when the native result is incomplete', async () => {
    const setState = vi.fn();

    const result = await runSocialSignIn('google', {
      getCurrentUserId: () => undefined,
      nativeSignIn: () =>
        Promise.resolve({
          code: 'google_missing_session',
          error: null,
          session: null,
          user: null,
        }),
      onResetUserStores: vi.fn(),
      setState,
    });

    expect(result).toEqual({
      error: 'Google sign-in failed. Please try again.',
    });
    expect(mocks.trackAuthTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'google_missing_session',
        provider: 'google',
        stage: 'failure',
      })
    );
  });
});
