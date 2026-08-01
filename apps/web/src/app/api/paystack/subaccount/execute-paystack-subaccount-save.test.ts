import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { executePaystackSubaccountSave } from './execute-paystack-subaccount-save';

const {
  mockCreateSubaccount,
  mockRevalidateTag,
  mockResolveAccountNumber,
  mockUpdateSubaccount,
} = vi.hoisted(() => ({
  mockCreateSubaccount: vi.fn(),
  mockRevalidateTag: vi.fn(),
  mockResolveAccountNumber: vi.fn(),
  mockUpdateSubaccount: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidateTag: (...args: unknown[]) => mockRevalidateTag(...args),
}));

vi.mock('@/lib/paystack', () => ({
  createSubaccount: (...args: unknown[]) => mockCreateSubaccount(...args),
  resolveAccountNumber: (...args: unknown[]) =>
    mockResolveAccountNumber(...args),
  updateSubaccount: (...args: unknown[]) => mockUpdateSubaccount(...args),
}));

const merchantId = '22222222-2222-4222-8222-222222222222';

function createSupabaseStub() {
  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn(() => ({ eq: updateEq }));
  const from = vi.fn(() => ({ update }));
  return { from, update, updateEq };
}

describe('executePaystackSubaccountSave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveAccountNumber.mockResolvedValue({
      success: true,
      data: { account_name: 'Jane Doe', account_number: '1234567890' },
    });
    mockCreateSubaccount.mockResolvedValue({
      success: true,
      data: { subaccount_code: 'ACCT_new123' },
    });
  });

  it('saves non-Nigerian manual bank details without calling Paystack', async () => {
    const supabase = createSupabaseStub();

    const result = await executePaystackSubaccountSave({
      accountName: 'Yodha Shopping',
      accountNumber: 'IN-123456789012',
      authUserEmail: 'owner@example.com',
      autoPayoutEnabled: false,
      bankCode: undefined,
      bankName: 'HDFC Bank',
      businessName: 'Yodha Shopping',
      merchantDetails: {
        businessName: 'Yodha Shopping',
        country: 'IN',
        email: 'merchant@example.com',
        paystackSubaccountCode: null,
        phone: null,
      },
      merchantId,
      shouldPersistAutoPayoutEnabled: false,
      supabase: supabase as unknown as SupabaseClient,
    });

    expect(result).toEqual({
      success: true,
      accountName: 'Yodha Shopping',
      subaccountCode: null,
    });
    expect(mockResolveAccountNumber).not.toHaveBeenCalled();
    expect(mockCreateSubaccount).not.toHaveBeenCalled();
    expect(supabase.update).toHaveBeenCalledWith({
      paystack_subaccount_code: null,
      bank_account_number: 'IN-123456789012',
      bank_account_name: 'Yodha Shopping',
      bank_code: null,
      bank_name: 'HDFC Bank',
    });
    expect(mockRevalidateTag).toHaveBeenCalledWith(
      `features-${merchantId}`,
      'merchant'
    );
  });

  it('creates and persists a Nigerian Paystack subaccount', async () => {
    const supabase = createSupabaseStub();

    const result = await executePaystackSubaccountSave({
      accountName: undefined,
      accountNumber: '1234567890',
      authUserEmail: 'owner@example.com',
      autoPayoutEnabled: false,
      bankCode: '044',
      bankName: undefined,
      businessName: 'Baci Store',
      merchantDetails: {
        businessName: 'Baci Store',
        country: 'NG',
        email: 'merchant@example.com',
        paystackSubaccountCode: null,
        phone: '08012345678',
      },
      merchantId,
      shouldPersistAutoPayoutEnabled: false,
      supabase: supabase as unknown as SupabaseClient,
    });

    expect(result).toEqual({
      success: true,
      accountName: 'Jane Doe',
      subaccountCode: 'ACCT_new123',
    });
    expect(mockResolveAccountNumber).toHaveBeenCalledWith('1234567890', '044');
    expect(mockCreateSubaccount).toHaveBeenCalledWith(
      expect.objectContaining({
        account_number: '1234567890',
        business_name: 'Baci Store',
        settlement_bank: '044',
      })
    );
    expect(supabase.update).toHaveBeenCalledWith({
      paystack_subaccount_code: 'ACCT_new123',
      bank_account_number: '1234567890',
      bank_account_name: 'Jane Doe',
      bank_code: '044',
      bank_name: 'Unknown Bank',
    });
    expect(mockRevalidateTag).toHaveBeenCalledWith(
      `features-${merchantId}`,
      'merchant'
    );
  });

  it('keeps cache revalidation outside the credential-authority import graph', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const source = readFileSync(
      join(import.meta.dirname, 'execute-paystack-subaccount-save.ts'),
      'utf8'
    );
    const specifiers = Array.from(
      source.matchAll(/(?:from\s+|import\s*)['"]([^'"]+)['"]/g)
    ).map((match) => match[1]);

    expect(specifiers).not.toContain('@/lib/cache-revalidation');
  });
});
