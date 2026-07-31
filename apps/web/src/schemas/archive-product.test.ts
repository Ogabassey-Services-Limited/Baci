import { describe, expect, it } from 'vitest';
import { archiveProductRequestSchema } from '@/schemas/archive-product';

describe('archiveProductRequestSchema', () => {
  it('requires a UUID merchant assertion for product archives', () => {
    expect(archiveProductRequestSchema.safeParse({}).success).toBe(false);
    expect(
      archiveProductRequestSchema.safeParse({ merchantId: 'merchant-1' })
        .success
    ).toBe(false);
  });

  it('accepts the merchant ID sent by the mobile archive request', () => {
    const result = archiveProductRequestSchema.safeParse({
      merchantId: '11111111-1111-4111-8111-111111111111',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        merchantId: '11111111-1111-4111-8111-111111111111',
      });
    }
  });
});
