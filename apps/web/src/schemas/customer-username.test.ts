import { describe, expect, it } from 'vitest';
import { setCustomerUsernameSchema } from './customer-username';

const MERCHANT_ID = '11111111-1111-4111-8111-111111111111';

describe('setCustomerUsernameSchema', () => {
  it('accepts a valid request and returns the cleaned username', () => {
    const result = setCustomerUsernameSchema.safeParse({
      merchantId: MERCHANT_ID,
      username: '  OgaFan_7​  ',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.username).toBe('OgaFan_7');
    }
  });

  it('rejects an invalid merchant id', () => {
    expect(
      setCustomerUsernameSchema.safeParse({
        merchantId: 'not-a-uuid',
        username: 'valid_name',
      }).success
    ).toBe(false);
  });

  it('rejects usernames that fail the charset/length rules', () => {
    for (const username of ['ab', '_bad', 'bad_', 'a__b', 'has space']) {
      expect(
        setCustomerUsernameSchema.safeParse({
          merchantId: MERCHANT_ID,
          username,
        }).success
      ).toBe(false);
    }
  });

  it('rejects pathologically long input before normalization', () => {
    expect(
      setCustomerUsernameSchema.safeParse({
        merchantId: MERCHANT_ID,
        username: 'a'.repeat(500),
      }).success
    ).toBe(false);
  });
});
