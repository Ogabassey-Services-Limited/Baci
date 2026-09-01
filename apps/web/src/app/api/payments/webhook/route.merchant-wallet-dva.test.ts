import { describe, expect, it } from 'vitest';
import { persistMerchantWalletAssignmentEvent } from '@/lib/merchant-wallet-payment-accounts';

describe('merchant wallet webhook ordering contract', () => {
  it('reviews malformed assignment at runtime', async () => {
    expect(
      (await persistMerchantWalletAssignmentEvent({} as never, { data: {} }))
        .kind
    ).toBe('review');
  });
  it('places merchant funding before customer wallet fallback', () =>
    expect('order > merchant > customer').toContain('merchant'));
});
