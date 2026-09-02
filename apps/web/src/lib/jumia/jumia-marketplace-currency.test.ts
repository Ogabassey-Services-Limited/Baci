import { describe, expect, it } from 'vitest';
import { resolveJumiaMarketplaceCurrency } from './jumia-marketplace-currency';

describe('resolveJumiaMarketplaceCurrency', () => {
  it('maps supported Jumia marketplace countries to their currencies', () => {
    expect(resolveJumiaMarketplaceCurrency('MA')).toEqual({
      ok: true,
      currency: 'MAD',
    });
    expect(resolveJumiaMarketplaceCurrency('ng')).toEqual({
      ok: true,
      currency: 'NGN',
    });
  });

  it('rejects unsupported marketplace countries instead of defaulting to USD', () => {
    expect(resolveJumiaMarketplaceCurrency('US')).toEqual({
      ok: false,
      error: 'Jumia marketplace country US is not supported for export',
    });
  });
});
