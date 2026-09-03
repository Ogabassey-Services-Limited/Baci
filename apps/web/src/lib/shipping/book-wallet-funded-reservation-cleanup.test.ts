import { describe, expect, it } from 'vitest';
import { hasReservedMerchantShippingCharge } from './book-wallet-funded-reservation-cleanup';

describe('hasReservedMerchantShippingCharge', () => {
  it('returns false when the client cannot query charges', async () => {
    await expect(
      hasReservedMerchantShippingCharge({} as never, 'o1', 'q1')
    ).resolves.toBe(false);
  });
});
