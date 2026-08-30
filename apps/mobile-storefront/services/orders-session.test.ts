import { jest } from '@jest/globals';
import type { Session } from '@supabase/supabase-js';

const mockWarn = jest.fn();

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({ warn: mockWarn }),
}));

const { getCheckoutStoredSession } =
  require('./orders-session') as typeof import('./orders-session');

describe('getCheckoutStoredSession', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('bounds a session read queued behind a pending refresh', async () => {
    jest.useFakeTimers();
    const result = getCheckoutStoredSession(
      { getItem: jest.fn(() => new Promise<never>(() => undefined)) },
      'auth-key',
      100
    );

    await jest.advanceTimersByTimeAsync(100);

    await expect(result).resolves.toBeNull();
    expect(mockWarn).toHaveBeenCalledWith(
      'Unable to read checkout session within timeout; using guest checkout',
      { error: 'Checkout session read timed out' }
    );
  });

  it('returns a normally persisted authenticated session unchanged', async () => {
    const session = {
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      user: { id: 'user-a' },
    } as Session;

    await expect(
      getCheckoutStoredSession(
        { getItem: jest.fn(async () => JSON.stringify(session)) },
        'auth-key'
      )
    ).resolves.toEqual(session);
  });

  it('returns null for a persisted guest session', async () => {
    await expect(
      getCheckoutStoredSession(
        { getItem: jest.fn(async () => null) },
        'auth-key'
      )
    ).resolves.toBeNull();
  });
});
