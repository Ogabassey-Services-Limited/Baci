// biome-ignore-all assist/source/organizeImports: auth-store-test-utils must be imported before @/stores/auth-store — its module-level vi.mock registrations have to run first, and import sorting would reorder them (breaks the suite with a raw-TS transform error).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createSession,
  createSignedOutAuthState,
  mocks,
} from './auth-store-test-utils';
import { useAuthStore } from '@/stores/auth-store';

describe('useAuthStore signIn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState(createSignedOutAuthState());
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
      isAuthenticated: false,
      session: null,
      user: null,
    });
    expect(mocks.clearAdminQueryCache).not.toHaveBeenCalled();
  });

  it('shows a friendly connectivity message when Android SSL handshake sign-in fails', async () => {
    mocks.signInWithPassword.mockRejectedValue(
      new Error(
        'fetch failed: javax.net.ssl.SSLHandshakeException: connection closed'
      )
    );

    const result = await useAuthStore
      .getState()
      .signIn('test+network@example.test', 'secret');

    expect(result.error).toBe(
      'Unable to connect. Please check your internet connection.'
    );
    expect(result.error).not.toContain('SSLHandshakeException');
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
    useAuthStore.setState(createSignedOutAuthState());
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

    expect(result).toEqual({ error: null, sessionEstablished: true });
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

describe('useAuthStore verifySignupOtp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState(createSignedOutAuthState());
  });

  it('commits the exact verified signup session through the global auth store', async () => {
    const session = createSession('verified-user');
    mocks.verifyOtp.mockResolvedValue({
      data: { session, user: session.user },
      error: null,
    });

    const result = await useAuthStore
      .getState()
      .verifySignupOtp(
        'merchant@example.test',
        '123456',
        '123e4567-e89b-42d3-a456-426614174000'
      );

    expect(result).toEqual({ error: null, sessionEstablished: true });
    expect(useAuthStore.getState()).toMatchObject({
      isAuthenticated: true,
      isInitialized: true,
      isLoading: false,
      session,
      user: session.user,
    });
    expect(mocks.clearAdminQueryCache).toHaveBeenCalledOnce();
    expect(mocks.captureMobileSignupLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({
        attemptId: '123e4567-e89b-42d3-a456-426614174000',
        eventCode: 'signup_verification_started',
        flow: 'merchant',
      })
    );
  });

  it('forwards an explicit staff flow through signup verification telemetry', async () => {
    const session = createSession('verified-staff-user');
    mocks.verifyOtp.mockResolvedValue({
      data: { session, user: session.user },
      error: null,
    });

    const result = await useAuthStore
      .getState()
      .verifySignupOtp(
        'staff@example.test',
        '123456',
        '123e4567-e89b-42d3-a456-426614174000',
        'staff'
      );

    expect(result).toEqual({ error: null, sessionEstablished: true });
    expect(mocks.captureMobileSignupLifecycle).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        attemptId: '123e4567-e89b-42d3-a456-426614174000',
        eventCode: 'signup_verification_started',
        flow: 'staff',
      })
    );
    expect(mocks.captureMobileSignupLifecycle).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        attemptId: '123e4567-e89b-42d3-a456-426614174000',
        eventCode: 'signup_verification_succeeded',
        flow: 'staff',
      })
    );
  });
});
