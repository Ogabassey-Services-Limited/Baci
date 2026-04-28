import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fulfillPendingVtuTransaction } from '@/lib/vtu-fulfillment';

const mockPurchaseAirtime = vi.fn();
const mockPurchaseData = vi.fn();
const mockCheckTransactionStatus = vi.fn();

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

type SupabaseStub = Parameters<
  typeof fulfillPendingVtuTransaction
>[0]['supabase'];

interface PendingTransactionMockOptions {
  transactionRow: Record<string, unknown>;
  rpcImpl?: (name: string) => Promise<{ data: unknown; error: unknown }>;
  merchantData?: { business_name?: string };
  claimData?: { id: string } | null;
}

function createPendingTransactionSupabaseMock({
  transactionRow,
  rpcImpl,
  merchantData = { business_name: 'OgaBassey' },
  claimData = { id: 'vtu-1' },
}: PendingTransactionMockOptions): SupabaseStub {
  const claimMaybeSingle = vi.fn().mockResolvedValue({
    data: claimData,
    error: null,
  });
  const merchantSingle = vi.fn().mockResolvedValue({
    data: merchantData,
    error: null,
  });

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
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  maybeSingle: claimMaybeSingle,
                }),
              }),
            }),
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
          customerWalletCredited: true,
          customerNewBalance: 500,
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
        metadata: {},
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
