import { describe, expect, it } from 'vitest';
import { updateMerchantCategorySchema } from './update-merchant-category';

describe('updateMerchantCategorySchema', () => {
  it.each([
    ['a rename', { name: 'Mobile Phones' }],
    ['a slug change', { slug: 'mobile-phones' }],
    ['a deactivation', { isActive: false }],
    ['a parent detach', { parentId: null }],
    ['a description clear', { description: null }],
  ])('accepts %s', (_label, body) => {
    expect(updateMerchantCategorySchema.safeParse(body).success).toBe(true);
  });

  it('rejects an empty patch', () => {
    // An empty PATCH would purge caches for no reason.
    expect(updateMerchantCategorySchema.safeParse({}).success).toBe(false);
  });

  it('rejects a patch carrying ONLY the merchant assertion', () => {
    expect(
      updateMerchantCategorySchema.safeParse({
        merchantId: '33333333-3333-4333-8333-333333333333',
      }).success
    ).toBe(false);
  });

  it('rejects a non-UUID merchantId', () => {
    expect(
      updateMerchantCategorySchema.safeParse({ merchantId: 'm-1', name: 'X' })
        .success
    ).toBe(false);
  });

  it('rejects a reserved slug', () => {
    expect(
      updateMerchantCategorySchema.safeParse({ slug: 'checkout' }).success
    ).toBe(false);
  });

  it('rejects a blank rename', () => {
    expect(updateMerchantCategorySchema.safeParse({ name: '  ' }).success).toBe(
      false
    );
  });
});
