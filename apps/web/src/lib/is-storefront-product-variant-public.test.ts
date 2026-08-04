import { describe, expect, it } from 'vitest';
import { isStorefrontProductVariantPublic } from './is-storefront-product-variant-public';

describe('isStorefrontProductVariantPublic', () => {
  it('matches the storefront visibility boundary', () => {
    expect(isStorefrontProductVariantPublic({})).toBe(true);
    expect(isStorefrontProductVariantPublic({ is_active: true })).toBe(true);
    expect(isStorefrontProductVariantPublic({ status: 'active' })).toBe(true);
    expect(isStorefrontProductVariantPublic({ is_active: false })).toBe(false);
    expect(isStorefrontProductVariantPublic({ status: 'inactive' })).toBe(
      false
    );
    expect(isStorefrontProductVariantPublic({ deleted_at: '2026-08-04' })).toBe(
      false
    );
    expect(
      isStorefrontProductVariantPublic({ archived_at: '2026-08-04' })
    ).toBe(false);
    expect(
      isStorefrontProductVariantPublic({ is_inventory_anchor: true })
    ).toBe(false);
  });
});
