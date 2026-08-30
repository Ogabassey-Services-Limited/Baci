import { jest } from '@jest/globals';
import { AuthRefreshDiscardedError, type Session } from '@supabase/supabase-js';

const mockWarn = jest.fn();

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({ warn: mockWarn }),
}));

const { resolveCheckoutAuth } =
  require('./orders-auth') as typeof import('./orders-auth');

function session(accessToken: string): Session {
  return {
    access_token: accessToken,
    refresh_token: 'refresh-token',
    user: { id: 'user-a' },
  } as Session;
}

describe('resolveCheckoutAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps guest checkout unauthenticated without attempting a refresh', async () => {
    const auth = {
      refreshSession: jest.fn(async () => ({
        data: { session: session('unexpected-token') },
        error: null,
      })),
    };

    await expect(resolveCheckoutAuth(auth, null)).resolves.toEqual({
      authorizationHeaders: {},
      canValidateUser: false,
      session: null,
    });
    expect(auth.refreshSession).not.toHaveBeenCalled();
  });

  it('returns a refreshed session minted by the active signing key', async () => {
    const refreshedSession = session('active-signing-key-token');
    const auth = {
      refreshSession: jest.fn(async () => ({
        data: { session: refreshedSession },
        error: null,
      })),
    };

    await expect(
      resolveCheckoutAuth(auth, session('stale-signing-key-token'))
    ).resolves.toEqual({
      authorizationHeaders: {
        Authorization: 'Bearer active-signing-key-token',
      },
      canValidateUser: true,
      session: refreshedSession,
    });
    expect(mockWarn).not.toHaveBeenCalled();
    expect(auth.refreshSession).toHaveBeenCalledWith({
      refresh_token: 'refresh-token',
    });
  });

  it('omits stale authorization when refresh resolves with an error', async () => {
    const storedSession = session('stored-token');
    const auth = {
      refreshSession: jest.fn(async () => ({
        data: { session: null },
        error: new Error('Refresh rejected'),
      })),
    };

    const result = await resolveCheckoutAuth(auth, storedSession);

    expect(result.session).toBeNull();
    expect(result.canValidateUser).toBe(false);
    expect(mockWarn).toHaveBeenCalledWith(
      'Unable to refresh checkout session; omitting authorization',
      { error: 'Refresh rejected' }
    );
    expect(result.authorizationHeaders).toEqual({});
  });

  it('does not reuse the stored session when a concurrent auth change discards the refresh', async () => {
    const auth = {
      refreshSession: jest.fn(async () => ({
        data: { session: null },
        error: new AuthRefreshDiscardedError(),
      })),
    };

    await expect(
      resolveCheckoutAuth(auth, session('previous-account-token'))
    ).resolves.toEqual({
      authorizationHeaders: {},
      canValidateUser: false,
      session: null,
    });
    expect(mockWarn).toHaveBeenCalledWith(
      'Checkout session refresh was discarded; omitting stale session'
    );
  });

  it('omits authorization when the refreshed session belongs to another account', async () => {
    const refreshedSession = {
      ...session('user-b-token'),
      user: { id: 'user-b' },
    } as Session;
    const auth = {
      refreshSession: jest.fn(async () => ({
        data: { session: refreshedSession },
        error: null,
      })),
    };

    await expect(
      resolveCheckoutAuth(auth, session('user-a-token'))
    ).resolves.toEqual({
      authorizationHeaders: {},
      canValidateUser: false,
      session: null,
    });
    expect(mockWarn).toHaveBeenCalledWith(
      'Checkout session identity changed during refresh; omitting authorization'
    );
  });

  it('omits stale authorization when refresh resolves without a session', async () => {
    const storedSession = session('stored-token');
    const auth = {
      refreshSession: jest.fn(async () => ({
        data: { session: null },
        error: null,
      })),
    };

    await expect(resolveCheckoutAuth(auth, storedSession)).resolves.toEqual({
      authorizationHeaders: {},
      canValidateUser: false,
      session: null,
    });
    expect(mockWarn).toHaveBeenCalledWith(
      'Unable to refresh checkout session; omitting authorization',
      { error: 'Refresh returned no session' }
    );
  });

  it('omits stale authorization when refresh rejects', async () => {
    const storedSession = session('stored-token');
    const auth = {
      refreshSession: jest.fn(async () => {
        throw new Error('Auth refresh unavailable');
      }),
    };

    await expect(resolveCheckoutAuth(auth, storedSession)).resolves.toEqual({
      authorizationHeaders: {},
      canValidateUser: false,
      session: null,
    });
    expect(mockWarn).toHaveBeenCalledWith(
      'Unable to refresh checkout session; omitting authorization',
      { error: 'Auth refresh unavailable' }
    );
  });

  it('bounds a pending refresh without reusing stale authorization', async () => {
    jest.useFakeTimers();
    const storedSession = session('stored-token');
    const auth = {
      refreshSession: jest.fn(() => new Promise<never>(() => undefined)),
    };
    const result = resolveCheckoutAuth(auth, storedSession, 100);

    await jest.advanceTimersByTimeAsync(100);

    await expect(result).resolves.toEqual({
      authorizationHeaders: {},
      canValidateUser: false,
      session: null,
    });
    expect(mockWarn).toHaveBeenCalledWith(
      'Unable to refresh checkout session; omitting authorization',
      { error: 'Checkout session refresh timed out' }
    );
  });
});
