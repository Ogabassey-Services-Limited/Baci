import { jest } from '@jest/globals';
import type { Session } from '@supabase/supabase-js';

const mockWarn = jest.fn();

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({ warn: mockWarn }),
}));

const { resolveCheckoutAuth } =
  require('./orders-auth') as typeof import('./orders-auth');

function session(accessToken: string): Session {
  return { access_token: accessToken } as Session;
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
      session: refreshedSession,
    });
    expect(mockWarn).not.toHaveBeenCalled();
  });

  it('warns and returns the stored session when refresh resolves with an error', async () => {
    const storedSession = session('stored-token');
    const auth = {
      refreshSession: jest.fn(async () => ({
        data: { session: null },
        error: new Error('Refresh rejected'),
      })),
    };

    const result = await resolveCheckoutAuth(auth, storedSession);

    expect(result.session).toBe(storedSession);
    expect(mockWarn).toHaveBeenCalledWith(
      'Unable to refresh checkout session; using stored session',
      { error: 'Refresh rejected' }
    );
    expect(result.authorizationHeaders).toEqual({
      Authorization: 'Bearer stored-token',
    });
  });

  it('warns and returns the stored session when refresh resolves without a session', async () => {
    const storedSession = session('stored-token');
    const auth = {
      refreshSession: jest.fn(async () => ({
        data: { session: null },
        error: null,
      })),
    };

    await expect(resolveCheckoutAuth(auth, storedSession)).resolves.toEqual({
      authorizationHeaders: { Authorization: 'Bearer stored-token' },
      session: storedSession,
    });
    expect(mockWarn).toHaveBeenCalledWith(
      'Unable to refresh checkout session; using stored session',
      { error: 'Refresh returned no session' }
    );
  });

  it('warns and returns the stored session when refresh rejects', async () => {
    const storedSession = session('stored-token');
    const auth = {
      refreshSession: jest.fn(async () => {
        throw new Error('Auth refresh unavailable');
      }),
    };

    await expect(resolveCheckoutAuth(auth, storedSession)).resolves.toEqual({
      authorizationHeaders: { Authorization: 'Bearer stored-token' },
      session: storedSession,
    });
    expect(mockWarn).toHaveBeenCalledWith(
      'Unable to refresh checkout session; using stored session',
      { error: 'Auth refresh unavailable' }
    );
  });

  it('bounds a pending refresh and falls back to the stored session', async () => {
    jest.useFakeTimers();
    const storedSession = session('stored-token');
    const auth = {
      refreshSession: jest.fn(() => new Promise<never>(() => undefined)),
    };
    const result = resolveCheckoutAuth(auth, storedSession, 100);

    await jest.advanceTimersByTimeAsync(100);

    await expect(result).resolves.toEqual({
      authorizationHeaders: { Authorization: 'Bearer stored-token' },
      session: storedSession,
    });
    expect(mockWarn).toHaveBeenCalledWith(
      'Unable to refresh checkout session; using stored session',
      { error: 'Checkout session refresh timed out' }
    );
  });
});
