import { describe, expect, it } from 'vitest';
import { isTerminalWalletFundingIntentStatus } from '@/lib/order-wallet-funding-intent-status';

describe('isTerminalWalletFundingIntentStatus', () => {
  it('treats the stop states as terminal', () => {
    for (const status of [
      'cancelled',
      'completed',
      'expired',
      'failed',
      'review_required',
    ] as const) {
      expect(isTerminalWalletFundingIntentStatus(status)).toBe(true);
    }
  });

  it('keeps polling for in-flight states, including a partial transfer', () => {
    for (const status of [
      'pending',
      'underfunded',
      'funded',
      'processing',
    ] as const) {
      expect(isTerminalWalletFundingIntentStatus(status)).toBe(false);
    }
  });
});
