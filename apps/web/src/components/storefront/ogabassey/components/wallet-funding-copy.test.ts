import { describe, expect, it } from 'vitest';
import { WALLET_FUNDING_COPY } from './wallet-funding-copy';

describe('WALLET_FUNDING_COPY', () => {
  it('quotes the verified Paystack DVA pricing (1% capped at ₦300) in fee copy', () => {
    expect(WALLET_FUNDING_COPY.feeNote).toContain('1%');
    expect(WALLET_FUNDING_COPY.feeNote).toContain('₦300');
    expect(WALLET_FUNDING_COPY.fundCtaSubtitle).toContain('1% fee');
    expect(WALLET_FUNDING_COPY.fundCtaSubtitle).toContain('₦300');
  });

  it('has non-empty copy for every key', () => {
    for (const [key, value] of Object.entries(WALLET_FUNDING_COPY)) {
      expect(value, `WALLET_FUNDING_COPY.${key}`).toBeTruthy();
      expect(typeof value).toBe('string');
    }
  });
});
