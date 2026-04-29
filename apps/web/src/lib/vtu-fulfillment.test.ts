import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fulfillPendingVtuTransaction } from '@/lib/vtu-fulfillment';

const mockPurchaseAirtime = vi.fn();
const mockPurchaseData = vi.fn();
const mockCheckTransactionStatus = vi.fn();
const mockNotifyCustomer = vi.fn();

vi.mock('@/lib/kuda', () => ({
  NetworkProvider: {
    MTN: 'MTN',
    AIRTEL: 'AIRTEL',
    GLO: 'GLO',
    MOBILE_9: '9MOBILE',
  },
  purchaseAirtime: (...args: unknown[]) => mockPurchaseAirtime(...args),
  purchaseData: (...args: unknown[]) => mockPurchaseData(...args),
  checkTransactionStatus: (...args: unknown[]) =>
    mockCheckTransactionStatus(...args),
}));

vi.mock('@/lib/kuda-bills', () => ({
  purchaseBill: vi.fn(),
}));

vi.mock('@/lib/expo-push', () => ({
  notifyCustomer: (...args: unknown[]) => mockNotifyCustomer(...args),
}));

type SupabaseStub = Parameters<
  typeof fulfillPendingVtuTransaction
>[0]['supabase'];

interface PendingTransactionMockOptions {
  customerData?: { user_id: string | null } | null;
  existingCustomerCashback?: { balance_after: number } | null;
  existingMerchantCommission?: { id: string } | null;
  transactionRow: Record<string, unknown>;
  rpcImpl?: (name: string) => Promise<{ data: unknown; error: unknown }>;
  merchantData?: { business_name?: string };
  claimData?: { id: string } | null;
  updatePayloads?: unknown[];
}

function createPendingTransactionSupabaseMock({
  customerData = { user_id: 'user-1' },
  existingCustomerCashback = null,
  existingMerchantCommission = null,
  transactionRow,
  rpcImpl,
  merchantData = { business_name: 'OgaBassey' },
  claimData = { id: 'vtu-1' },
  updatePayloads = [],
}: PendingTransactionMockOptions): SupabaseStub {
  const claimMaybeSingle = vi.fn().mockResolvedValue({
    data: claimData,
    error: null,
  });
  const merchantSingle = vi.fn().mockResolvedValue({
    data: merchantData,
    error: null,
  });
  const customerMaybeSingle = vi.fn().mockResolvedValue({
    data: customerData,
    error: null,
  });
  const existingCustomerCashbackMaybeSingle = vi.fn().mockResolvedValue({
    data: existingCustomerCashback,
    error: null,
  });
  const existingMerchantCommissionMaybeSingle = vi.fn().mockResolvedValue({
    data: existingMerchantCommission,
    error: null,
  });
  const makeMaybeSingleChain = (maybeSingle: ReturnType<typeof vi.fn>) => {
    const chain = {
      eq: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      maybeSingle,
      order: vi.fn(() => chain),
      select: vi.fn(() => chain),
    };
    return chain;
  };

  return {
    from: vi.fn((table: string) => {
      if (table === 'vtu_transactions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi
                .fn()
                .mockResolvedValue({ data: transactionRow, error: null }),
            }),
          }),
          update: vi.fn((payload: unknown) => {
            updatePayloads.push(payload);
            return {
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  select: vi.fn().mockReturnValue({
                    maybeSingle: claimMaybeSingle,
                  }),
                }),
              }),
            };
          }),
        };
      }

      if (table === 'customer_wallet_transactions') {
        const chain = makeMaybeSingleChain(existingCustomerCashbackMaybeSingle);
        return {
          select: vi.fn(() => chain),
        };
      }

      if (table === 'wallet_transactions') {
        const chain = makeMaybeSingleChain(
          existingMerchantCommissionMaybeSingle
        );
        return {
          select: vi.fn(() => chain),
        };
      }

      if (table === 'customers') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ maybeSingle: customerMaybeSingle }),
          }),
        };
      }

      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ single: merchantSingle }),
        }),
      };
    }),
    rpc: vi.fn(rpcImpl ?? (() => Promise.resolve({ data: null, error: null }))),
  } as unknown as SupabaseStub;
}

describe('fulfillPendingVtuTransaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckTransactionStatus.mockResolvedValue({
      message: 'No token',
      status: 'successful',
    });
    mockNotifyCustomer.mockResolvedValue({ errors: [], failed: 0, sent: 1 });
  });

  it('returns the existing success payload without repurchasing', async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: 'vtu-1',
        merchant_id: 'merchant-1',
        customer_id: 'customer-1',
        type: 'airtime',
        network_provider: 'MTN',
        phone_number: '08012345678',
        amount: 1000,
        request_reference: 'VTU-123',
        transaction_id: 'kuda-1',
        status: 'successful',
        metadata: {
          customerNotificationAttempted: true,
          customerWalletCredited: true,
          customerNewBalance: 500,
          merchantWalletCredited: true,
        },
        error_message: null,
        merchant_commission: 10,
        customer_cashback: 5,
        biller_name: null,
        biller_item_code: null,
        customer_identifier: null,
      },
      error: null,
    });

    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ single }),
        }),
      })),
    } as unknown as Parameters<
      typeof fulfillPendingVtuTransaction
    >[0]['supabase'];

    const result = await fulfillPendingVtuTransaction({
      supabase,
      transactionId: 'vtu-1',
    });

    expect(result).toEqual({
      amount: 1000,
      cashback: { amount: 5, credited: true, newBalance: 500 },
      customerIdentifier: undefined,
      reference: 'VTU-123',
      status: 'successful',
    });
    expect(mockPurchaseAirtime).not.toHaveBeenCalled();
  });

  it('backfills missing customer cashback for an already successful transaction', async () => {
    const updatePayloads: unknown[] = [];
    const supabase = createPendingTransactionSupabaseMock({
      claimData: null,
      transactionRow: {
        id: 'vtu-1',
        merchant_id: 'merchant-1',
        customer_id: 'customer-1',
        type: 'airtime',
        network_provider: 'MTN',
        phone_number: '08012345678',
        amount: 1500,
        request_reference: 'VTU-123',
        transaction_id: 'kuda-1',
        status: 'successful',
        metadata: {},
        error_message: null,
        merchant_commission: 0,
        customer_cashback: 11.25,
        biller_name: null,
        biller_item_code: null,
        customer_identifier: null,
      },
      rpcImpl: (name: string) => {
        if (name === 'credit_customer_wallet') {
          return Promise.resolve({
            data: [{ new_balance: 25.75 }],
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      },
      updatePayloads,
    });

    const result = await fulfillPendingVtuTransaction({
      supabase,
      transactionId: 'vtu-1',
    });

    expect(supabase.rpc).toHaveBeenCalledWith('credit_customer_wallet', {
      p_amount: 11.25,
      p_customer_id: 'customer-1',
      p_description: 'Cashback - Airtime MTN ₦1500',
      p_merchant_id: 'merchant-1',
      p_source_id: 'vtu-1',
      p_source_type: 'vtu_transaction',
    });
    expect(result).toMatchObject({
      cashback: { amount: 11.25, credited: true, newBalance: 25.75 },
      status: 'successful',
    });
    expect(updatePayloads).toContainEqual({
      metadata: expect.objectContaining({
        customerNewBalance: 25.75,
        customerNotificationAttempted: true,
        customerNotificationSent: true,
        customerWalletCredited: true,
      }),
    });
    expect(mockNotifyCustomer).toHaveBeenCalledWith(
      'user-1',
      'Airtime purchase successful',
      'Your MTN airtime purchase of ₦1,500 was successful. ₦11.25 cashback was credited to your wallet.',
      {
        amount: 1500,
        cashbackAmount: 11.25,
        reference: 'VTU-123',
        transactionId: 'vtu-1',
        type: 'vtu_purchase_success',
        vtuType: 'airtime',
      },
      'orders'
    );
  });

  it('reuses an existing cashback ledger when success metadata was not updated', async () => {
    const supabase = createPendingTransactionSupabaseMock({
      claimData: null,
      existingCustomerCashback: { balance_after: 11.25 },
      transactionRow: {
        id: 'vtu-1',
        merchant_id: 'merchant-1',
        customer_id: 'customer-1',
        type: 'airtime',
        network_provider: 'MTN',
        phone_number: '08012345678',
        amount: 1500,
        request_reference: 'VTU-123',
        transaction_id: 'kuda-1',
        status: 'successful',
        metadata: {
          customerNotificationAttempted: true,
        },
        error_message: null,
        merchant_commission: 0,
        customer_cashback: 11.25,
        biller_name: null,
        biller_item_code: null,
        customer_identifier: null,
      },
    });

    const result = await fulfillPendingVtuTransaction({
      supabase,
      transactionId: 'vtu-1',
    });

    expect(supabase.rpc).not.toHaveBeenCalledWith(
      'credit_customer_wallet',
      expect.anything()
    );
    expect(result).toMatchObject({
      cashback: { amount: 11.25, credited: true, newBalance: 11.25 },
      status: 'successful',
    });
  });

  it('claims a pending transaction, purchases airtime, and credits wallets', async () => {
    mockPurchaseAirtime.mockResolvedValue({
      success: true,
      message: 'ok',
      transactionId: 'kuda-1',
      amount: 1000,
      status: 'successful',
    });

    const supabase = createPendingTransactionSupabaseMock({
      transactionRow: {
        id: 'vtu-1',
        merchant_id: 'merchant-1',
        customer_id: 'customer-1',
        type: 'airtime',
        network_provider: 'MTN',
        phone_number: '08012345678',
        amount: 1000,
        request_reference: 'VTU-123',
        transaction_id: null,
        status: 'pending',
        metadata: {
          customerNotificationAttempted: true,
        },
        error_message: null,
        merchant_commission: 10,
        customer_cashback: 5,
        biller_name: null,
        biller_item_code: null,
        customer_identifier: null,
      },
      rpcImpl: (name: string) => {
        if (name === 'credit_customer_wallet') {
          return Promise.resolve({ data: [{ new_balance: 505 }], error: null });
        }
        return Promise.resolve({ data: null, error: null });
      },
    });

    const result = await fulfillPendingVtuTransaction({
      supabase,
      transactionId: 'vtu-1',
    });

    expect(result).toEqual({
      amount: 1000,
      cashback: { amount: 5, credited: true, newBalance: 505 },
      customerIdentifier: undefined,
      reference: 'VTU-123',
      status: 'successful',
    });
    expect(mockPurchaseAirtime).toHaveBeenCalledWith(
      '08012345678',
      1000,
      'MTN',
      'OgaBassey',
      'VTU-123'
    );
  });

  it('normalizes mobile provider IDs before purchasing airtime', async () => {
    mockPurchaseAirtime.mockResolvedValue({
      success: true,
      message: 'ok',
      transactionId: 'kuda-1',
      amount: 1000,
      status: 'successful',
    });

    const supabase = createPendingTransactionSupabaseMock({
      transactionRow: {
        id: 'vtu-1',
        merchant_id: 'merchant-1',
        customer_id: null,
        type: 'airtime',
        network_provider: 'mtn',
        phone_number: '08012345678',
        amount: 1000,
        request_reference: 'VTU-123',
        transaction_id: null,
        status: 'pending',
        metadata: {},
        error_message: null,
        merchant_commission: 0,
        customer_cashback: 0,
        biller_name: null,
        biller_item_code: null,
        customer_identifier: null,
      },
    });

    const result = await fulfillPendingVtuTransaction({
      supabase,
      transactionId: 'vtu-1',
    });

    expect(result).toMatchObject({
      amount: 1000,
      reference: 'VTU-123',
      status: 'successful',
    });
    expect(mockPurchaseAirtime).toHaveBeenCalledWith(
      '08012345678',
      1000,
      'MTN',
      'OgaBassey',
      'VTU-123'
    );
  });

  it('retries a failed transaction only when gateway reconciliation allows it', async () => {
    mockPurchaseAirtime.mockResolvedValue({
      success: true,
      message: 'ok',
      transactionId: 'kuda-retry-1',
      amount: 1000,
      status: 'successful',
    });

    const supabase = createPendingTransactionSupabaseMock({
      transactionRow: {
        id: 'vtu-1',
        merchant_id: 'merchant-1',
        customer_id: null,
        type: 'airtime',
        network_provider: 'MTN',
        phone_number: '08012345678',
        amount: 1000,
        request_reference: 'VTU-123',
        transaction_id: null,
        status: 'failed',
        metadata: {
          paymentReference: 'VTU-PAYSTACK-123',
        },
        error_message: 'Temporary biller error',
        merchant_commission: 0,
        customer_cashback: 0,
        biller_name: null,
        biller_item_code: null,
        customer_identifier: null,
      },
    });

    const result = await fulfillPendingVtuTransaction({
      retryFailed: true,
      supabase,
      transactionId: 'vtu-1',
    });

    expect(result).toMatchObject({
      amount: 1000,
      reference: 'VTU-123',
      status: 'successful',
    });
    expect(mockPurchaseAirtime).toHaveBeenCalledWith(
      '08012345678',
      1000,
      'MTN',
      'OgaBassey',
      'VTU-123'
    );
  });

  it('backfills a missing electricity token from Kuda bill status', async () => {
    const mockPurchaseBill = await import('@/lib/kuda-bills').then((module) =>
      vi.mocked(module.purchaseBill)
    );
    mockPurchaseBill.mockResolvedValue({
      success: true,
      reference: 'VTU-123',
      message: 'ok',
      transactionId: 'kuda-bill-1',
      amount: 500,
      status: 'successful',
    });
    mockCheckTransactionStatus.mockResolvedValue({
      message: 'ok',
      pin: '1234-5678-9012',
      status: 'successful',
    });

    const supabase = createPendingTransactionSupabaseMock({
      transactionRow: {
        id: 'vtu-1',
        merchant_id: 'merchant-1',
        customer_id: null,
        type: 'electricity',
        network_provider: '',
        phone_number: '',
        amount: 500,
        request_reference: 'VTU-123',
        transaction_id: null,
        status: 'pending',
        metadata: {},
        error_message: null,
        merchant_commission: 0,
        customer_cashback: 0,
        biller_name: 'EKEDC NG - EKEDC PREPAID',
        biller_item_code: 'KUD-ELE-EKED-002',
        customer_identifier: '43901766923',
      },
    });

    const result = await fulfillPendingVtuTransaction({
      supabase,
      transactionId: 'vtu-1',
    });

    expect(result).toMatchObject({
      amount: 500,
      reference: 'VTU-123',
      status: 'successful',
      voucherPin: '1234-5678-9012',
    });
    expect(mockCheckTransactionStatus).toHaveBeenCalledWith(
      'kuda-bill-1',
      'VTU-123'
    );
  });
});
