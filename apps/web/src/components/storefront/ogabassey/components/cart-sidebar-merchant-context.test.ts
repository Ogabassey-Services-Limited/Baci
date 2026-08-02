import { describe, expect, it } from 'vitest';
import { hasCartMerchantContext } from './cart-sidebar-merchant-context';

describe('hasCartMerchantContext', () => {
  it('accepts a cart without an explicit merchant slug', () => {
    expect(hasCartMerchantContext(null, 'ogabassey')).toBe(true);
  });

  it('rejects a cart slug from another storefront context', () => {
    expect(hasCartMerchantContext('winter-store', 'ogabassey')).toBe(false);
  });
});
