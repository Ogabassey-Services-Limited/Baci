import { describe, expect, it } from 'vitest';
import { paystackSubaccountSchema } from '@/schemas/paystack-subaccount';

describe('paystackSubaccountSchema', () => {
  it('parses snake_case payloads', () => {
    const result = paystackSubaccountSchema.parse({
      account_number: '1234567890',
      bank_code: '044',
      business_name: 'Baci Store',
      payout_mode: 'weekly',
      auto_payout_enabled: true,
    });

    expect(result).toEqual({
      account_number: '1234567890',
      bank_code: '044',
      business_name: 'Baci Store',
      payout_mode: 'weekly',
      auto_payout_enabled: true,
    });
  });

  it('parses camelCase payloads and applies defaults', () => {
    const result = paystackSubaccountSchema.parse({
      accountNumber: '1234567890',
      bankCode: '058',
      businessName: 'Baci Store',
    });

    expect(result).toEqual({
      account_number: '1234567890',
      bank_code: '058',
      business_name: 'Baci Store',
      payout_mode: 'manual',
      auto_payout_enabled: false,
    });
  });

  it('allows business name to be omitted for merchant fallback', () => {
    const result = paystackSubaccountSchema.parse({
      accountNumber: '1234567890',
      bankCode: '058',
    });

    expect(result.business_name).toBeUndefined();
  });

  it('rejects invalid account numbers', () => {
    const result = paystackSubaccountSchema.safeParse({
      accountNumber: '123',
      bankCode: '058',
    });

    expect(result.success).toBe(false);
  });

  it('rejects unsupported payout modes', () => {
    const result = paystackSubaccountSchema.safeParse({
      accountNumber: '1234567890',
      bankCode: '058',
      payoutMode: 'daily',
    });

    expect(result.success).toBe(false);
  });

  it('accepts alphanumeric bank codes (ALAT 035A)', () => {
    const result = paystackSubaccountSchema.safeParse({
      account_number: '1234567890',
      bank_code: '035A',
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.bank_code).toBe('035A');
  });

  it('accepts camelCase with fintech bank code (MFB50992)', () => {
    const result = paystackSubaccountSchema.safeParse({
      accountNumber: '1234567890',
      bankCode: 'MFB50992',
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.bank_code).toBe('MFB50992');
  });
});
