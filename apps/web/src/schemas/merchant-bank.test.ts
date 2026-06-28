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

  it('parses manual invoice bank details without a Paystack bank code', () => {
    const result = merchantBankSchema.parse({
      accountNumber: 'IN-123456789012',
      bankName: 'HDFC Bank',
      accountName: 'Yodha Shopping',
      businessName: 'Yodha Shopping',
      manualBankDetails: true,
    });

    expect(result).toEqual({
      accountNumber: 'IN-123456789012',
      bankName: 'HDFC Bank',
      accountName: 'Yodha Shopping',
      businessName: 'Yodha Shopping',
      manualBankDetails: true,
    });
  });

  it('allows manual invoice bank details with a blank optional account name', () => {
    const result = merchantBankSchema.safeParse({
      accountNumber: 'IN-123456789012',
      bankName: 'HDFC Bank',
      accountName: '',
      businessName: 'Yodha Shopping',
      manualBankDetails: true,
    });

    expect(result.success).toBe(true);
  });

  it('validates manual account number length after removing separators', () => {
    const result = merchantBankSchema.safeParse({
      accountNumber: 'AB12 CD34 EF56 GH78 IJ90 KL12 MN34 OP56 QR',
      bankName: 'HDFC Bank',
      businessName: 'Yodha Shopping',
      manualBankDetails: true,
    });

    expect(result.success).toBe(true);
  });

  it('rejects manual account numbers longer than 34 characters after removing separators', () => {
    const result = merchantBankSchema.safeParse({
      accountNumber: 'AB12 CD34 EF56 GH78 IJ90 KL12 MN34 OP56 QR7',
      bankName: 'HDFC Bank',
      businessName: 'Yodha Shopping',
      manualBankDetails: true,
    });

    expect(result.success).toBe(false);
  });

  it('rejects manual account numbers with excessive raw separators', () => {
    const result = merchantBankSchema.safeParse({
      accountNumber: `ABCDEF${'-'.repeat(1000)}`,
      bankName: 'HDFC Bank',
      businessName: 'Yodha Shopping',
      manualBankDetails: true,
    });

    expect(result.success).toBe(false);
  });

  it('rejects manual account numbers with unsupported characters', () => {
    const result = merchantBankSchema.safeParse({
      accountNumber: 'IN_123456789012',
      bankName: 'HDFC Bank',
      businessName: 'Yodha Shopping',
      manualBankDetails: true,
    });

    expect(result.success).toBe(false);
  });

  it('rejects manual account numbers shorter than 6 characters after removing separators', () => {
    const result = merchantBankSchema.safeParse({
      accountNumber: 'AB-12 3',
      bankName: 'HDFC Bank',
      businessName: 'Yodha Shopping',
      manualBankDetails: true,
    });

    expect(result.success).toBe(false);
  });

  it('does not infer manual invoice mode from bank name alone', () => {
    const result = merchantBankSchema.safeParse({
      accountNumber: 'IN-123456789012',
      bankName: 'HDFC Bank',
      accountName: 'Yodha Shopping',
      businessName: 'Yodha Shopping',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.bankCode).toContain(
        'Please select your bank'
      );
    }
  });

  it('rejects manual invoice bank details without a bank name', () => {
    const result = merchantBankSchema.safeParse({
      accountNumber: 'IN-123456789012',
      accountName: 'Yodha Shopping',
      businessName: 'Yodha Shopping',
      manualBankDetails: true,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.bankName).toContain(
        'Bank name is required'
      );
    }
  });

  it('rejects invalid account numbers', () => {
    const result = merchantBankSchema.safeParse({
      accountNumber: '123',
      bankCode: '044',
      businessName: 'Baci Store',
    });

    expect(result.success).toBe(false);
  });

  it('rejects whitespace-only business names', () => {
    const result = merchantBankSchema.safeParse({
      accountNumber: '1234567890',
      bankCode: '044',
      businessName: '   ',
    });

    expect(result.success).toBe(false);
  });

  it('trims business names before returning parsed data', () => {
    const result = merchantBankSchema.parse({
      accountNumber: '1234567890',
      bankCode: '044',
      businessName: '  Baci Store  ',
    });

    expect(result.businessName).toBe('Baci Store');
  });
});
