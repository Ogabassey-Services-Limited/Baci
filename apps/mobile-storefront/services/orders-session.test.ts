import { jest } from '@jest/globals';

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
      { getSession: jest.fn(() => new Promise<never>(() => undefined)) },
      100
    );

    await jest.advanceTimersByTimeAsync(100);

    await expect(result).resolves.toBeNull();
    expect(mockWarn).toHaveBeenCalledWith(
      'Unable to read checkout session within timeout; using guest checkout',
      { error: 'Checkout session read timed out' }
    );
  });
});
