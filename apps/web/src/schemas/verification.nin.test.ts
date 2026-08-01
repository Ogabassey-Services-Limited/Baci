import { describe, expect, it } from 'vitest';
import { ninVerifySchema } from '@/schemas/verification';

describe('ninVerifySchema', () => {
  const validNIN = {
    nin: '12345678901',
    firstName: 'Jane',
    lastName: 'Doe',
    dateOfBirth: '1992-05-15',
    merchantId: '11111111-1111-4111-8111-111111111111',
  };

  it('parses valid NIN data', () => {
    const result = ninVerifySchema.safeParse(validNIN);
    expect(result.success).toBe(true);
  });

  it('requires an explicit merchant selection for NIN verification', () => {
    const { merchantId: _merchantId, ...withoutMerchantId } = validNIN;

    expect(ninVerifySchema.safeParse(withoutMerchantId).success).toBe(false);
  });

  it('rejects NIN with fewer than 11 digits', () => {
    const result = ninVerifySchema.safeParse({
      ...validNIN,
      nin: '1234567890',
    });
    expect(result.success).toBe(false);
  });

  it('rejects NIN with more than 11 digits', () => {
    const result = ninVerifySchema.safeParse({
      ...validNIN,
      nin: '123456789012',
    });
    expect(result.success).toBe(false);
  });

  it('rejects NIN containing non-digit characters', () => {
    const result = ninVerifySchema.safeParse({
      ...validNIN,
      nin: '1234567890X',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty firstName', () => {
    const result = ninVerifySchema.safeParse({ ...validNIN, firstName: '' });
    expect(result.success).toBe(false);
  });

  it('rejects empty lastName', () => {
    const result = ninVerifySchema.safeParse({ ...validNIN, lastName: '' });
    expect(result.success).toBe(false);
  });

  it('rejects empty dateOfBirth', () => {
    const result = ninVerifySchema.safeParse({ ...validNIN, dateOfBirth: '' });
    expect(result.success).toBe(false);
  });

  it('rejects dateOfBirth not in YYYY-MM-DD format', () => {
    const result = ninVerifySchema.safeParse({
      ...validNIN,
      dateOfBirth: '15/05/1992',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid calendar date (e.g. Feb 31)', () => {
    const result = ninVerifySchema.safeParse({
      ...validNIN,
      dateOfBirth: '2025-02-31',
    });
    expect(result.success).toBe(false);
  });

  it('rejects firstName exceeding 100 chars', () => {
    const result = ninVerifySchema.safeParse({
      ...validNIN,
      firstName: 'A'.repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it('rejects lastName exceeding 100 chars', () => {
    const result = ninVerifySchema.safeParse({
      ...validNIN,
      lastName: 'A'.repeat(101),
    });
    expect(result.success).toBe(false);
  });
});
