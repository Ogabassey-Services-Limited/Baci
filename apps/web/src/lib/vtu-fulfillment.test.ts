import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fulfillPendingVtuTransaction } from '@/lib/vtu-fulfillment';

const mockPurchaseAirtime = vi.fn();
const mockPurchaseData = vi.fn();
const mockPurchaseBill = vi.fn();

vi.mock('@/lib/kuda', () => ({
  NetworkProvider: {
    MTN: 'MTN',
    AIRTEL: 'AIRTEL',
    GLO: 'GLO',
    MOBILE_9: '9MOBILE',
  },
  purchaseAirtime: (...args: unknown[]) => mockPurchaseAirtime(...args),
  purchaseData: (...args: unknown[]) => mockPurchaseData(...args),
}));

vi.mock('@/lib/kuda-bills', () => ({
  purchaseBill: (...args: unknown[]) => mockPurchaseBill(...args),
}));

describe('fulfillPendingVtuTransaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    const claimMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'vtu-1' },
      error: null,
    });
    const merchantSingle = vi.fn().mockResolvedValue({
      data: { business_name: 'OgaBassey' },
      error: null,
    });

    mockPurchaseAirtime.mockResolvedValue({
      success: true,
      message: 'ok',
      transactionId: 'kuda-1',
      amount: 1000,
      status: 'successful',
    });

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'vtu_transactions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
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
                  error: null,
                }),
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
      rpc: vi.fn((name: string) => {
        if (name === 'credit_customer_wallet') {
          return Promise.resolve({ data: [{ new_balance: 505 }], error: null });
        }

        return Promise.resolve({ data: null, error: null });
      }),
    } as unknown as Parameters<
      typeof fulfillPendingVtuTransaction
    >[0]['supabase'];

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
    const claimMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'vtu-1' },
      error: null,
    });
    const merchantSingle = vi.fn().mockResolvedValue({
      data: { business_name: 'OgaBassey' },
      error: null,
    });

    mockPurchaseAirtime.mockResolvedValue({
      success: true,
      message: 'ok',
      transactionId: 'kuda-1',
      amount: 1000,
      status: 'successful',
    });

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'vtu_transactions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
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
                  error: null,
                }),
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
      rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
    } as unknown as Parameters<
      typeof fulfillPendingVtuTransaction
    >[0]['supabase'];

    await fulfillPendingVtuTransaction({
      supabase,
      transactionId: 'vtu-1',
    });

    expect(mockPurchaseAirtime).toHaveBeenCalledWith(
      '08012345678',
      1000,
      'MTN',
      'OgaBassey',
      'VTU-123'
    );
  });
});
