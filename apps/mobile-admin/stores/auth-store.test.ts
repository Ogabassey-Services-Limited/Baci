import type { Session, User } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/stores/auth-store';

const mocks = vi.hoisted(() => ({
  clearAdminQueryCache: vi.fn(),
  getSession: vi.fn(),
  getUser: vi.fn(),
  onAuthStateChange: vi.fn(() => ({
    data: { subscription: { unsubscribe: vi.fn() } },
  })),
  resetSettings: vi.fn(),
  revenueCleanup: vi.fn(),
  signInWithAppleNative: vi.fn(),
  signInWithGoogleNative: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  signUp: vi.fn(),
  trackAuthTelemetry: vi.fn(),
}));

vi.mock('@/lib/query-client', () => ({
  clearAdminQueryCache: mocks.clearAdminQueryCache,
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
      getUser: mocks.getUser,
      onAuthStateChange: mocks.onAuthStateChange,
      signInWithPassword: mocks.signInWithPassword,
      signOut: mocks.signOut,
      signUp: mocks.signUp,
    },
  },
}));

vi.mock('@/lib/auth/sign-in-with-apple', () => ({
  signInWithAppleNative: mocks.signInWithAppleNative,
}));

vi.mock('@/lib/auth/sign-in-with-google', () => ({
  signInWithGoogleNative: mocks.signInWithGoogleNative,
}));

vi.mock('@/stores/revenueCatStore', () => ({
  useRevenueCatStore: {
    getState: () => ({
      cleanup: mocks.revenueCleanup,
    }),
  },
}));

vi.mock('@/services/auth-telemetry', () => ({
  trackAuthTelemetry: mocks.trackAuthTelemetry,
}));

vi.mock('@/hooks/useSettingsStore', () => ({
  useSettingsStore: {
    getState: () => ({
      reset: mocks.resetSettings,
    }),
  },
}));

function createSession(): Session {
  const user: User = {
    app_metadata: {
      provider: 'email',
      providers: ['email'],
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

describe('useAuthStore signIn', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useAuthStore.setState({
      activeAuthProvider: null,
      isAuthenticating: false,
      isAuthenticated: false,
      isInitialized: true,
      isLoading: false,
      session: null,
      user: null,
    });
  });

  it('commits the returned session immediately after password sign-in', async () => {
    const session = createSession();

    mocks.signInWithPassword.mockResolvedValue({
      data: {
        session,
        user: session.user,
      },
      error: null,
    });

    const result = await useAuthStore
      .getState()
      .signIn('test+password@example.test', 'secret');

    expect(result.error).toBeNull();
    expect(useAuthStore.getState()).toMatchObject({
      activeAuthProvider: null,
      isAuthenticating: false,
      isAuthenticated: true,
      isInitialized: true,
      isLoading: false,
      session,
      user: session.user,
    });

    await vi.waitFor(() => {
      expect(mocks.clearAdminQueryCache).toHaveBeenCalledTimes(1);
      expect(mocks.revenueCleanup).toHaveBeenCalledTimes(1);
      expect(mocks.resetSettings).toHaveBeenCalledTimes(1);
    });
  });

  it('does not mark the user authenticated when Supabase returns an error', async () => {
    const authError = { message: 'Invalid login credentials' };

    mocks.signInWithPassword.mockResolvedValue({
      data: {
        session: null,
        user: null,
      },
      error: authError,
    });

    const result = await useAuthStore
      .getState()
      .signIn('test+invalid@example.test', 'wrong-password');

    expect(result.error).toBe(authError.message);
    expect(useAuthStore.getState()).toMatchObject({
      activeAuthProvider: null,
      isAuthenticating: false,
    });
    expect(useAuthStore.getState()).toMatchObject({
      isAuthenticated: false,
      session: null,
      user: null,
    });
    expect(mocks.clearAdminQueryCache).not.toHaveBeenCalled();
  });

  it('commits the returned session immediately after Google sign-in', async () => {
    const session = createSession();

    mocks.signInWithGoogleNative.mockResolvedValue({
      error: null,
      metadata: {
        usedTokenFallback: true,
      },
      session,
      user: session.user,
    });

    const result = await useAuthStore.getState().signInWithGoogle();

    expect(result).toEqual({ error: null });
    expect(useAuthStore.getState()).toMatchObject({
      activeAuthProvider: null,
      isAuthenticating: false,
      isAuthenticated: true,
      session,
      user: session.user,
    });

    await vi.waitFor(() => {
      expect(mocks.clearAdminQueryCache).toHaveBeenCalledTimes(1);
      expect(mocks.trackAuthTelemetry).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'google',
          stage: 'success',
        })
      );
    });
  });

  it('returns a cancelled result for Apple sign-in without setting an error state', async () => {
    mocks.signInWithAppleNative.mockResolvedValue({
      cancelled: true,
      code: 'apple_user_cancelled',
      error: null,
      session: null,
      user: null,
    });

    const result = await useAuthStore.getState().signInWithApple();

    expect(result).toEqual({ cancelled: true, error: null });
    expect(useAuthStore.getState()).toMatchObject({
      activeAuthProvider: null,
      isAuthenticating: false,
      isAuthenticated: false,
      session: null,
      user: null,
    });
    expect(mocks.trackAuthTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'apple',
        stage: 'cancel',
      })
    );
  });
});

describe('useAuthStore signUp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      activeAuthProvider: null,
      isAuthenticating: false,
      isAuthenticated: false,
      isInitialized: true,
      isLoading: false,
      session: null,
      user: null,
    });
  });

  it('commits the session for a brand-new account (no merchant created)', async () => {
    const session = createSession();
    mocks.signUp.mockResolvedValue({
      data: { session, user: session.user },
      error: null,
    });

    const result = await useAuthStore
      .getState()
      .signUp({ email: 'new@example.test', password: 'sup3r-secret-pw' });

    expect(result).toEqual({ error: null });
    expect(useAuthStore.getState()).toMatchObject({
      isAuthenticated: true,
      session,
      user: session.user,
    });
  });

  it('reports an existing account without authenticating', async () => {
    mocks.signUp.mockResolvedValue({
      data: { user: { identities: [] }, session: null },
      error: null,
    });

    const result = await useAuthStore
      .getState()
      .signUp({ email: 'existing@example.test', password: 'sup3r-secret-pw' });

    expect(result).toEqual({ error: null, accountExists: true });
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
