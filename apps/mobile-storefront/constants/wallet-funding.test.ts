import { describe, expect, it } from '@jest/globals';
import {
  WALLET_FUNDING_CHECKING_STATE_ENABLED,
  WALLET_FUNDING_POLLING,
} from './wallet-funding';

describe('wallet-funding constants', () => {
  it('exposes the polling interval and timeout used by the funding loops', () => {
    expect(WALLET_FUNDING_POLLING.INTERVAL_MS).toBe(5000);
    expect(WALLET_FUNDING_POLLING.TIMEOUT_MS).toBe(120000);
  });

  it('keeps the checking-state dark-launch kill-switch off by default', () => {
    expect(typeof WALLET_FUNDING_CHECKING_STATE_ENABLED).toBe('boolean');
    expect(WALLET_FUNDING_CHECKING_STATE_ENABLED).toBe(false);
  });
});
