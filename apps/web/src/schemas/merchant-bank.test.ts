import { describe, expect, it } from 'vitest';
import { merchantBankSchema } from '@/schemas/merchant-bank';

describe('merchantBankSchema', () => {
  it('parses valid bank form data', () => {
    const result = merchantBankSchema.parse({
      accountNumber: '1234567890',
      bankCode: '044',
      businessName: 'Baci Store',
      autoPayoutEnabled: true,
    });

    expect(result).toEqual({
      accountNumber: '1234567890',
      bankCode: '044',
      businessName: 'Baci Store',
      autoPayoutEnabled: true,
    });
  });

  it('allows auto payout setting to be omitted', () => {
    const result = merchantBankSchema.parse({
      accountNumber: '1234567890',
      bankCode: '044',
      businessName: 'Baci Store',
    });

    expect(result).toEqual({
      accountNumber: '1234567890',
      bankCode: '044',
      businessName: 'Baci Store',
    });
  });

  it('rejects invalid account numbers', () => {
    const result = merchantBankSchema.safeParse({
      accountNumber: '123',
      bankCode: '044',
      businessName: 'Baci Store',
    });

    expect(result.success).toBe(false);
  });
});
