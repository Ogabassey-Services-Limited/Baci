import { describe, expect, it, jest } from '@jest/globals';
import { router } from 'expo-router';
import { imeiCheckScreenActions } from './imei-check-screen-actions';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

describe('imeiCheckScreenActions', () => {
  it('rounds a wallet shortfall up and preserves the return route', () => {
    imeiCheckScreenActions.fundWallet(999.2);

    expect(router.push).toHaveBeenCalledWith(
      '/wallet?action=fund&requiredAmount=1000&returnTo=/imei-check'
    );
  });

  it('distinguishes request timeouts from other network errors', () => {
    const timeout = new Error('timeout');
    timeout.name = 'AbortError';

    expect(imeiCheckScreenActions.networkErrorMessage(timeout)).toMatch(
      /timed out/i
    );
    expect(
      imeiCheckScreenActions.networkErrorMessage(new Error('offline'))
    ).toMatch(/network error/i);
  });
});
