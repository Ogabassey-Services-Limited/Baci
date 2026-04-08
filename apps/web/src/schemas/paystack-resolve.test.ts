import { describe, expect, it } from 'vitest';
import { resolvePaystackAccountSchema } from '@/schemas/paystack-resolve';

describe('resolvePaystackAccountSchema', () => {
  it('parses snake_case payloads', () => {
    const result = resolvePaystackAccountSchema.parse({
      account_number: '1234567890',
      bank_code: '044',
    });

    expect(result).toEqual({
      account_number: '1234567890',
      bank_code: '044',
    });
  });

  it('parses camelCase payloads', () => {
    const result = resolvePaystackAccountSchema.parse({
      accountNumber: '1234567890',
      bankCode: '058',
    });

    expect(result).toEqual({
      account_number: '1234567890',
      bank_code: '058',
    });
  });

  it('rejects invalid account numbers', () => {
    const result = resolvePaystackAccountSchema.safeParse({
      account_number: '123',
      bank_code: '044',
    });

    expect(result.success).toBe(false);
  });

  it('rejects invalid bank codes', () => {
    const result = resolvePaystackAccountSchema.safeParse({
      account_number: '1234567890',
      bank_code: 'AB-12', // hyphens are not valid
    });

    expect(result.success).toBe(false);
  });

  it('accepts alphanumeric bank codes (ALAT 035A)', () => {
    const result = resolvePaystackAccountSchema.safeParse({
      account_number: '1234567890',
      bank_code: '035A',
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.bank_code).toBe('035A');
  });

  it('accepts camelCase with alphanumeric bank code (MFB50992)', () => {
    const result = resolvePaystackAccountSchema.safeParse({
      accountNumber: '1234567890',
      bankCode: 'MFB50992',
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.bank_code).toBe('MFB50992');
  });
});
