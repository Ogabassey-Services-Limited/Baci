import { describe, expect, it } from 'vitest';
import { adminMerchantRouteParamsSchema } from '@/schemas/admin-merchant-route-params';

describe('adminMerchantRouteParamsSchema', () => {
  it('accepts valid merchant ids', () => {
    const result = adminMerchantRouteParamsSchema.safeParse({
      merchantId: '11111111-1111-4111-8111-111111111111',
    });

    expect(result.success).toBe(true);
    expect(result.data?.merchantId).toBe(
      '11111111-1111-4111-8111-111111111111'
    );
  });

  it('rejects invalid merchant ids', () => {
    const result = adminMerchantRouteParamsSchema.safeParse({
      merchantId: 'not-a-uuid',
    });

    expect(result.success).toBe(false);
  });

  it.each([
    ['empty string', { merchantId: '' }],
    ['missing field', {}],
    ['null field', { merchantId: null }],
    ['undefined field', { merchantId: undefined }],
    ['number field', { merchantId: 123 }],
    ['object field', { merchantId: { id: 'merchant' } }],
    ['whitespace field', { merchantId: '   ' }],
    ['missing hyphens', { merchantId: '11111111111141118111111111111111' }],
    ['wrong length', { merchantId: '11111111-1111-4111-8111-11111111111' }],
    [
      'invalid characters',
      { merchantId: 'zzzzzzzz-1111-4111-8111-111111111111' },
    ],
  ])('rejects %s', (_label, input) => {
    const result = adminMerchantRouteParamsSchema.safeParse(input);

    expect(result.success).toBe(false);
  });

  it('throws the configured message when parsing an invalid uuid', () => {
    expect(() =>
      adminMerchantRouteParamsSchema.parse({ merchantId: 'not-a-uuid' })
    ).toThrow('Invalid merchant ID');
  });
});
