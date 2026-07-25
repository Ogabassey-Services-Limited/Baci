import { describe, expect, it } from 'vitest';
import { createMerchantCategorySchema } from './create-merchant-category';

const VALID = { name: 'Phones', slug: 'phones' };

describe('createMerchantCategorySchema', () => {
  it('accepts the minimal payload', () => {
    expect(createMerchantCategorySchema.safeParse(VALID).success).toBe(true);
  });

  it('trims a padded name', () => {
    const result = createMerchantCategorySchema.safeParse({
      ...VALID,
      name: '  Phones  ',
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe('Phones');
  });

  it.each([
    ['a missing name', { slug: 'phones' }],
    ['a blank name', { ...VALID, name: '   ' }],
    ['a missing slug', { name: 'Phones' }],
    ['a reserved slug', { ...VALID, slug: 'checkout' }],
    ['a non-UUID parentId', { ...VALID, parentId: 'nope' }],
    ['a non-URL imageUrl', { ...VALID, imageUrl: 'not a url' }],
    ['a negative displayOrder', { ...VALID, displayOrder: -1 }],
    ['a fractional displayOrder', { ...VALID, displayOrder: 1.5 }],
  ])('rejects %s', (_label, body) => {
    expect(createMerchantCategorySchema.safeParse(body).success).toBe(false);
  });

  it('treats merchantId as an optional assertion, never a requirement', () => {
    // The route derives the tenant from the session; this field only ever
    // selects among merchants the caller already reaches.
    expect(createMerchantCategorySchema.safeParse(VALID).success).toBe(true);
    expect(
      createMerchantCategorySchema.safeParse({
        ...VALID,
        merchantId: '33333333-3333-4333-8333-333333333333',
      }).success
    ).toBe(true);
  });

  it('rejects a non-UUID merchantId before it reaches a UUID column', () => {
    expect(
      createMerchantCategorySchema.safeParse({ ...VALID, merchantId: 'm-1' })
        .success
    ).toBe(false);
  });

  it('rejects a name longer than the shared 160-character bound', () => {
    expect(
      createMerchantCategorySchema.safeParse({
        ...VALID,
        name: 'a'.repeat(161),
      }).success
    ).toBe(false);
  });
});
