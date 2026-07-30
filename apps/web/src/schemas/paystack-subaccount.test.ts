import { describe, expect, it } from 'vitest';
import { paystackSubaccountSchema } from '@/schemas/paystack-subaccount';

describe('paystackSubaccountSchema', () => {
  it('preserves the validated requested merchant ID for exact-target routes', () => {
    const result = paystackSubaccountSchema.parse({
      accountNumber: '1234567890',
      bankCode: '044',
      merchantId: '33333333-3333-4333-8333-333333333333',
    });

    expect(result).toMatchObject({
      merchant_id: '33333333-3333-4333-8333-333333333333',
    });
  });

  it('rejects malformed requested merchant IDs', () => {
    const result = paystackSubaccountSchema.safeParse({
      accountNumber: '1234567890',
      bankCode: '044',
      merchantId: 'merchant-a',
    });

    expect(result.success).toBe(false);
  });

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

  it('parses manual invoice bank details without a Paystack bank code', () => {
    const result = paystackSubaccountSchema.parse({
      accountNumber: 'IN-123456789012',
      bankName: 'HDFC Bank',
      accountName: 'Yodha Shopping',
      businessName: 'Yodha Shopping',
    });

    expect(result).toEqual({
      account_number: 'IN-123456789012',
      bank_code: '',
      bank_name: 'HDFC Bank',
      account_name: 'Yodha Shopping',
      business_name: 'Yodha Shopping',
      payout_mode: 'manual',
      auto_payout_enabled: false,
    });
  });

  it('allows manual invoice bank details with a blank optional account name', () => {
    const result = paystackSubaccountSchema.safeParse({
      accountNumber: 'IN-123456789012',
      bankName: 'HDFC Bank',
      accountName: '',
      businessName: 'Yodha Shopping',
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.account_name).toBeUndefined();
  });

  it('validates manual account number length after removing separators', () => {
    const result = paystackSubaccountSchema.safeParse({
      accountNumber: 'AB12 CD34 EF56 GH78 IJ90 KL12 MN34 OP56 QR',
      bankName: 'HDFC Bank',
      businessName: 'Yodha Shopping',
    });

    expect(result.success).toBe(true);
  });

  it('rejects manual account numbers longer than 34 characters after removing separators', () => {
    const result = paystackSubaccountSchema.safeParse({
      accountNumber: 'AB12 CD34 EF56 GH78 IJ90 KL12 MN34 OP56 QR7',
      bankName: 'HDFC Bank',
      businessName: 'Yodha Shopping',
    });

    expect(result.success).toBe(false);
  });

  it('rejects manual account numbers with excessive raw separators', () => {
    const result = paystackSubaccountSchema.safeParse({
      accountNumber: `ABCDEF${'-'.repeat(1000)}`,
      bankName: 'HDFC Bank',
      businessName: 'Yodha Shopping',
    });

    expect(result.success).toBe(false);
  });

  it('rejects manual account numbers with unsupported characters', () => {
    const result = paystackSubaccountSchema.safeParse({
      accountNumber: 'IN_123456789012',
      bankName: 'HDFC Bank',
      businessName: 'Yodha Shopping',
    });

    expect(result.success).toBe(false);
  });

  it('rejects manual account numbers shorter than 6 characters after removing separators', () => {
    const result = paystackSubaccountSchema.safeParse({
      accountNumber: 'AB-12 3',
      bankName: 'HDFC Bank',
      businessName: 'Yodha Shopping',
    });

    expect(result.success).toBe(false);
  });

  it('rejects account names shorter than 2 characters', () => {
    const result = paystackSubaccountSchema.safeParse({
      accountNumber: 'IN-123456789012',
      bankName: 'HDFC Bank',
      accountName: 'Y',
    });

    expect(result.success).toBe(false);
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
