import { describe, expect, it } from 'vitest';
import { shouldReuseBoundAdminWalletGiglQuote } from './load-bound-admin-wallet-gigl-quote';

describe('shouldReuseBoundAdminWalletGiglQuote', () => {
  it('reuses a bound merchant-wallet GIGL quote outside preview', () => {
    expect(
      shouldReuseBoundAdminWalletGiglQuote(
        {
          selected_quote_id: 'quote-1',
          shipping_funding_source: 'merchant_wallet',
          shipping_provider: 'GIGL',
        },
        false
      )
    ).toBe('quote-1');
  });

  it('does not reuse preview requests or non-wallet orders', () => {
    expect(
      shouldReuseBoundAdminWalletGiglQuote(
        {
          selected_quote_id: 'quote-1',
          shipping_funding_source: 'merchant_wallet',
          shipping_provider: 'GIGL',
        },
        true
      )
    ).toBeNull();
    expect(
      shouldReuseBoundAdminWalletGiglQuote(
        {
          selected_quote_id: 'quote-1',
          shipping_funding_source: 'customer_checkout',
          shipping_provider: 'GIGL',
        },
        false
      )
    ).toBeNull();
  });
});
