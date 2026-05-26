import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ensureCustomerWalletPaymentAccount,
  findCustomerWalletPaymentAccountByReceiver,
} from '@/lib/customer-wallet-payment-accounts';
import {
  createDedicatedAccountForWallet,
  createOrGetCustomer,
  getDedicatedAccounts,
} from '@/lib/paystack';
import {
  createInsertErrorQuery,
  createMaybeSingleQuery,
  createSelectRowsQuery,
  customer,
  existingAccountRow,
  merchant,
} from './customer-wallet-payment-accounts.test-utils';

vi.mock('@/lib/paystack', () => ({
  createDedicatedAccountForWallet: vi.fn(),
  createOrGetCustomer: vi.fn(),
  getDedicatedAccounts: vi.fn(),
}));

function mockNewDedicatedAccount() {
  vi.mocked(createOrGetCustomer).mockResolvedValue({
    success: true,
    data: {
      customer_code: 'CUS_new',
      email: 'jane@example.com',
      first_name: 'Jane',
      id: 100,
      last_name: 'Doe',
      phone: '+2348012345678',
    },
  });
  vi.mocked(createDedicatedAccountForWallet).mockResolvedValue({
    success: true,
    data: {
      accountName: 'Ogabassey/Jane Doe',
      accountNumber: '2222222222',
      bankName: 'Test Bank',
      bankSlug: 'test-bank',
      currency: 'NGN',
      providerAccountId: '98',
      providerCustomerCode: 'CUS_new',
      providerSubaccountCode: 'ACCT_merchant123',
    },
  });
}

describe('customer wallet payment account conflicts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDedicatedAccounts).mockResolvedValue({
      success: true,
      data: [],
    });
  });

  it('re-reads and returns the winner when a concurrent insert creates the account first', async () => {
    mockNewDedicatedAccount();
    const accountQuery = createMaybeSingleQuery(null);
    const orderAliasQuery = createSelectRowsQuery([]);
    const { query: insertQuery } = createInsertErrorQuery({
      code: '23505',
      message: 'duplicate key value violates unique constraint',
    });
    const rereadQuery = createMaybeSingleQuery({
      ...existingAccountRow,
      account_number: '2222222222',
      bank_name: 'Test Bank',
      bank_slug: 'test-bank',
      provider_account_id: '98',
      provider_customer_code: 'CUS_new',
    });
    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(accountQuery)
        .mockReturnValueOnce(orderAliasQuery)
        .mockReturnValueOnce(insertQuery)
        .mockReturnValueOnce(rereadQuery),
    } as unknown as SupabaseClient;

    await expect(
      ensureCustomerWalletPaymentAccount({
        consentedAt: new Date('2026-05-21T10:00:00.000Z'),
        customer,
        merchant,
        supabase,
      })
    ).resolves.toEqual(
      expect.objectContaining({
        accountNumber: '2222222222',
      })
    );
  });

  it('fails with a receiver conflict when a concurrent insert assigns the DVA to another customer', async () => {
    mockNewDedicatedAccount();
    const accountQuery = createMaybeSingleQuery(null);
    const orderAliasQuery = createSelectRowsQuery([]);
    const { query: insertQuery } = createInsertErrorQuery({
      code: '23505',
      message: 'duplicate key value violates unique constraint',
    });
    const rereadQuery = createMaybeSingleQuery(null);
    const receiverQuery = createMaybeSingleQuery({
      ...existingAccountRow,
      account_number: '2222222222',
      customer_id: 'other-customer',
    });
    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(accountQuery)
        .mockReturnValueOnce(orderAliasQuery)
        .mockReturnValueOnce(insertQuery)
        .mockReturnValueOnce(rereadQuery)
        .mockReturnValueOnce(receiverQuery),
    } as unknown as SupabaseClient;

    await expect(
      ensureCustomerWalletPaymentAccount({
        consentedAt: new Date('2026-05-21T10:00:00.000Z'),
        customer,
        merchant,
        supabase,
      })
    ).rejects.toMatchObject({
      code: 'WALLET_DVA_RECEIVER_CONFLICT',
    });
  });

  it('returns a typed error when Paystack DVA creation fails', async () => {
    vi.mocked(createOrGetCustomer).mockResolvedValue({
      success: true,
      data: {
        customer_code: 'CUS_new',
        email: 'jane@example.com',
        first_name: 'Jane',
        id: 100,
        last_name: 'Doe',
        phone: '+2348012345678',
      },
    });
    vi.mocked(createDedicatedAccountForWallet).mockResolvedValue({
      success: false,
      error: 'Dedicated account provider unavailable',
      code: 'PAYSTACK_ERROR',
    });

    const accountQuery = createMaybeSingleQuery(null);
    const supabase = {
      from: vi.fn().mockReturnValueOnce(accountQuery),
    } as unknown as SupabaseClient;

    await expect(
      ensureCustomerWalletPaymentAccount({
        consentedAt: new Date('2026-05-21T10:00:00.000Z'),
        customer,
        merchant,
        supabase,
      })
    ).rejects.toMatchObject({
      code: 'PAYSTACK_DVA_ERROR',
    });
  });

  it('finds an active account by receiver account number', async () => {
    const accountQuery = createMaybeSingleQuery(existingAccountRow);
    const supabase = {
      from: vi.fn(() => accountQuery),
    } as unknown as SupabaseClient;

    await expect(
      findCustomerWalletPaymentAccountByReceiver({
        receiverAccountNumber: '1234567890',
        supabase,
      })
    ).resolves.toEqual(
      expect.objectContaining({
        accountNumber: '1234567890',
        customerId: 'customer-1',
        merchantId: 'merchant-1',
      })
    );
  });
});
