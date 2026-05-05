import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fulfillPendingVtuTransaction } from '@/lib/vtu-fulfillment';

const mockPurchaseAirtime = vi.fn();
const mockPurchaseData = vi.fn();
const mockCheckTransactionStatus = vi.fn();
const mockNotifyCustomer = vi.fn();
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
  checkTransactionStatus: (...args: unknown[]) =>
    mockCheckTransactionStatus(...args),
}));

vi.mock('@/lib/kuda-bills', () => ({
  purchaseBill: (...args: unknown[]) => mockPurchaseBill(...args),
}));

vi.mock('@/lib/expo-push', () => ({
  notifyCustomer: (...args: unknown[]) => mockNotifyCustomer(...args),
}));

type SupabaseStub = Parameters<
  typeof fulfillPendingVtuTransaction
>[0]['supabase'];

interface PendingTransactionMockOptions {
  customerData?: { user_id: string | null } | null;
  currentTransactionData?: Record<string, unknown> | null;
  existingCustomerCashback?: { balance_after: number } | null;
  existingMerchantCommission?: { id: string } | null;
  transactionRow: Record<string, unknown>;
  rpcImpl?: (name: string) => Promise<{ data: unknown; error: unknown }>;
  merchantData?: { business_name?: string };
  claimData?: { id: string } | null;
  notificationClaimData?: { id: string } | null;
  purchaseUpdateErrors?: Array<{ message: string } | null>;
  updateErrors?: {
    finalMetadata?: { message: string };
    purchase?: { message: string };
    successMetadata?: { message: string };
  };
  updatePayloads?: unknown[];
}

type PendingTransactionUpdateErrors = NonNullable<
  PendingTransactionMockOptions['updateErrors']
>;
type PendingTransactionUpdateError =
  PendingTransactionUpdateErrors[keyof PendingTransactionUpdateErrors];

function selectUpdateError(
  payloadRecord: Record<string, unknown>,
  transactionRow: Record<string, unknown>,
  updateErrors: NonNullable<PendingTransactionMockOptions['updateErrors']>
): PendingTransactionUpdateError {
  if (
    payloadRecord.status === 'successful' ||
    payloadRecord.status === 'failed'
  ) {
    return updateErrors.purchase;
  }

  if (transactionRow.status === 'successful') {
    return updateErrors.successMetadata;
  }

  return updateErrors.finalMetadata;
}

function isClaimOrErrorUpdate(payloadRecord: Record<string, unknown>): boolean {
  return (
    payloadRecord.status === 'processing' ||
    ('error_message' in payloadRecord && !('metadata' in payloadRecord))
  );
}

function findPayloadWithMetadata(
  payloads: unknown[],
  predicate: (metadata: Record<string, unknown>) => boolean
): { metadata: Record<string, unknown> } | undefined {
  return payloads.find(
    (payload): payload is { metadata: Record<string, unknown> } => {
      if (typeof payload !== 'object' || payload === null) {
        return false;
      }
      const metadata = (payload as { metadata?: unknown }).metadata;
      return (
        typeof metadata === 'object' &&
        metadata !== null &&
        predicate(metadata as Record<string, unknown>)
      );
    }
  );
}

function createPendingTransactionSupabaseMock({
  customerData = { user_id: 'user-1' },
  currentTransactionData,
  existingCustomerCashback = null,
  existingMerchantCommission = null,
  transactionRow,
  rpcImpl,
  merchantData = { business_name: 'OgaBassey' },
  claimData = { id: 'vtu-1' },
  notificationClaimData = { id: 'vtu-1' },
  purchaseUpdateErrors,
  updateErrors = {},
  updatePayloads = [],
}: PendingTransactionMockOptions): SupabaseStub {
  let purchaseUpdateAttempt = 0;
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
  const notificationClaimMaybeSingle = vi.fn().mockResolvedValue({
    data: notificationClaimData,
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
          select: vi.fn((columns?: string) => ({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data:
                  columns === 'error_message, status'
                    ? (currentTransactionData ?? transactionRow)
                    : transactionRow,
                error: null,
              }),
            }),
          })),
          update: vi.fn((payload: unknown) => {
            updatePayloads.push(payload);
            const payloadRecord =
              payload && typeof payload === 'object'
                ? (payload as Record<string, unknown>)
                : {};
            const metadataPayload =
              payloadRecord.metadata &&
              typeof payloadRecord.metadata === 'object'
                ? (payloadRecord.metadata as Record<string, unknown>)
                : null;
            const isNotificationClaim =
              metadataPayload?.customerNotificationAttempted === true &&
              !('customerNotificationSent' in metadataPayload) &&
              !('paymentPending' in metadataPayload) &&
              !('status' in payloadRecord);
            const isRetryReconciliation =
              payloadRecord.status === 'successful' &&
              payloadRecord.error_message === null &&
              !('metadata' in payloadRecord) &&
              !('transaction_id' in payloadRecord);

            if (isNotificationClaim) {
              const notificationClaimChain = {
                eq: vi.fn(() => notificationClaimChain),
                maybeSingle: notificationClaimMaybeSingle,
                or: vi.fn(() => notificationClaimChain),
                select: vi.fn(() => notificationClaimChain),
              };
              return notificationClaimChain;
            }

            if (isRetryReconciliation) {
              const retryReconciliationChain = {
                eq: vi.fn(() => retryReconciliationChain),
                maybeSingle: claimMaybeSingle,
                select: vi.fn(() => retryReconciliationChain),
              };
              return retryReconciliationChain;
            }

            if (!isClaimOrErrorUpdate(payloadRecord)) {
              let updateError = selectUpdateError(
                payloadRecord,
                transactionRow,
                updateErrors
              );
              if (
                (payloadRecord.status === 'successful' ||
                  payloadRecord.status === 'failed') &&
                purchaseUpdateErrors &&
                purchaseUpdateErrors.length > 0
              ) {
                const errorIndex = Math.min(
                  purchaseUpdateAttempt,
                  purchaseUpdateErrors.length - 1
                );
                updateError = purchaseUpdateErrors[errorIndex] ?? undefined;
                purchaseUpdateAttempt += 1;
              }

              return {
                eq: vi.fn().mockResolvedValue({
                  data: null,
                  error: updateError ?? null,
                }),
              };
            }

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
    mockPurchaseAirtime.mockReset();
    mockPurchaseData.mockReset();
    mockPurchaseBill.mockReset();
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
          // Regression coverage for Supabase clients that surface a single
          // RPC row instead of an array of rows.
          return Promise.resolve({
            data: { new_balance: 25.75 },
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

  it('returns success when successful-transaction metadata cannot be persisted', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
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
      updateErrors: {
        successMetadata: { message: 'metadata write failed' },
      },
    });

    try {
      const result = await fulfillPendingVtuTransaction({
        supabase,
        transactionId: 'vtu-1',
      });

      expect(result).toMatchObject({
        amount: 1500,
        cashback: { amount: 11.25, credited: true, newBalance: 25.75 },
        reference: 'VTU-123',
        status: 'successful',
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to persist VTU transaction metadata:',
        expect.objectContaining({
          error: 'metadata write failed',
          transactionId: 'vtu-1',
        })
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
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
    mockCheckTransactionStatus.mockResolvedValueOnce({
      message: 'Original attempt failed',
      status: 'failed',
    });
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
    expect(mockCheckTransactionStatus).toHaveBeenCalledWith(
      undefined,
      'VTU-123'
    );
    expect(mockPurchaseAirtime).toHaveBeenCalledWith(
      '08012345678',
      1000,
      'MTN',
      'OgaBassey',
      'VTU-123'
    );
  });

  it('does not retry a failed transaction when gateway reconciliation finds success', async () => {
    const updatePayloads: unknown[] = [];
    mockCheckTransactionStatus.mockResolvedValueOnce({
      message: 'Original attempt succeeded',
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
      updatePayloads,
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
    expect(mockCheckTransactionStatus).toHaveBeenCalledWith(
      undefined,
      'VTU-123'
    );
    expect(mockPurchaseAirtime).not.toHaveBeenCalled();
    expect(updatePayloads).toContainEqual({
      error_message: null,
      status: 'successful',
    });
  });

  it('does not treat non-enum database statuses as provider statuses during retry reconciliation', async () => {
    mockCheckTransactionStatus.mockResolvedValueOnce({
      message: 'Original attempt succeeded',
      status: 'successful',
    });

    const supabase = createPendingTransactionSupabaseMock({
      claimData: null,
      currentTransactionData: {
        error_message: 'Concurrent status is not claimable',
        status: 'completed',
      },
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
        metadata: {},
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

    expect(result).toEqual({
      amount: 1000,
      reference: 'VTU-123',
      status: 'processing',
    });
    expect(mockPurchaseAirtime).not.toHaveBeenCalled();
  });

  it('does not retry a failed transaction while gateway reconciliation is still processing', async () => {
    const updatePayloads: unknown[] = [];
    mockCheckTransactionStatus.mockResolvedValueOnce({
      message: 'Original attempt still pending',
      status: 'processing',
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
      updatePayloads,
    });

    const result = await fulfillPendingVtuTransaction({
      retryFailed: true,
      supabase,
      transactionId: 'vtu-1',
    });

    expect(result).toMatchObject({
      amount: 1000,
      error: 'Original utility purchase is still processing with the provider',
      reference: 'VTU-123',
      status: 'failed',
    });
    expect(mockCheckTransactionStatus).toHaveBeenCalledWith(
      undefined,
      'VTU-123'
    );
    expect(mockPurchaseAirtime).not.toHaveBeenCalled();
    expect(updatePayloads).toEqual([]);
  });

  it('does not retry a failed transaction when retryFailed is false', async () => {
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
      retryFailed: false,
      supabase,
      transactionId: 'vtu-1',
    });

    expect(result).toMatchObject({
      amount: 1000,
      error: 'Temporary biller error',
      reference: 'VTU-123',
      status: 'failed',
    });
    expect(mockPurchaseAirtime).not.toHaveBeenCalled();
  });

  it('preserves an existing transaction id when a successful purchase omits a new one', async () => {
    const updatePayloads: unknown[] = [];
    mockPurchaseAirtime.mockResolvedValue({
      success: true,
      message: 'ok',
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
        transaction_id: 'existing-kuda-1',
        status: 'pending',
        metadata: {},
        error_message: null,
        merchant_commission: 0,
        customer_cashback: 0,
        biller_name: null,
        biller_item_code: null,
        customer_identifier: null,
      },
      updatePayloads,
    });

    await fulfillPendingVtuTransaction({
      supabase,
      transactionId: 'vtu-1',
    });

    expect(updatePayloads).toContainEqual(
      expect.objectContaining({
        status: 'successful',
        transaction_id: 'existing-kuda-1',
      })
    );
  });

  it('persists customer notification attempt metadata when notification sending fails', async () => {
    const updatePayloads: unknown[] = [];
    mockPurchaseAirtime.mockResolvedValue({
      success: true,
      message: 'ok',
      transactionId: 'kuda-1',
      amount: 1000,
      status: 'successful',
    });
    mockNotifyCustomer.mockRejectedValueOnce(new Error('push failed'));

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
        merchant_commission: 0,
        customer_cashback: 0,
        biller_name: null,
        biller_item_code: null,
        customer_identifier: null,
      },
      updatePayloads,
    });

    await fulfillPendingVtuTransaction({
      supabase,
      transactionId: 'vtu-1',
    });

    expect(updatePayloads).toContainEqual({
      metadata: expect.objectContaining({
        customerNotificationAttempted: true,
        customerNotificationSent: false,
        paymentPending: false,
      }),
    });
  });

  it('does not notify when another worker claimed customer notification', async () => {
    const updatePayloads: unknown[] = [];
    mockPurchaseAirtime.mockResolvedValue({
      success: true,
      message: 'ok',
      transactionId: 'kuda-1',
      amount: 1000,
      status: 'successful',
    });

    const supabase = createPendingTransactionSupabaseMock({
      notificationClaimData: null,
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
        merchant_commission: 0,
        customer_cashback: 0,
        biller_name: null,
        biller_item_code: null,
        customer_identifier: null,
      },
      updatePayloads,
    });

    await fulfillPendingVtuTransaction({
      supabase,
      transactionId: 'vtu-1',
    });

    expect(mockNotifyCustomer).not.toHaveBeenCalled();
    const finalMetadataPayload = findPayloadWithMetadata(
      updatePayloads,
      (metadata) => metadata.paymentPending === false
    );
    expect(finalMetadataPayload).toEqual(
      expect.objectContaining({
        metadata: expect.not.objectContaining({
          customerNotificationSent: expect.anything(),
        }),
      })
    );
  });

  it('throws when the purchase result cannot be persisted', async () => {
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
        network_provider: 'MTN',
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
      updateErrors: {
        purchase: { message: 'purchase write failed' },
      },
    });

    await expect(
      fulfillPendingVtuTransaction({
        supabase,
        transactionId: 'vtu-1',
      })
    ).rejects.toThrow('Failed to persist VTU purchase result');
  });

  it('retries provider result persistence when the first update fails', async () => {
    vi.useFakeTimers();
    const consoleWarnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const updatePayloads: unknown[] = [];
    mockPurchaseAirtime.mockResolvedValue({
      success: true,
      message: 'ok',
      transactionId: 'kuda-1',
      amount: 1000,
      status: 'successful',
    });

    const supabase = createPendingTransactionSupabaseMock({
      purchaseUpdateErrors: [
        { message: 'transient purchase write failed' },
        null,
      ],
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
        status: 'pending',
        metadata: {},
        error_message: null,
        merchant_commission: 0,
        customer_cashback: 0,
        biller_name: null,
        biller_item_code: null,
        customer_identifier: null,
      },
      updatePayloads,
    });

    try {
      const resultPromise = fulfillPendingVtuTransaction({
        supabase,
        transactionId: 'vtu-1',
      });
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toMatchObject({
        amount: 1000,
        reference: 'VTU-123',
        status: 'successful',
      });
      const purchasePayloads = updatePayloads.filter(
        (payload): payload is Record<string, unknown> =>
          typeof payload === 'object' &&
          payload !== null &&
          (payload as Record<string, unknown>).status === 'successful' &&
          'transaction_id' in payload
      );
      expect(purchasePayloads).toHaveLength(2);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Retrying VTU purchase result persistence after failed update:',
        expect.objectContaining({
          attempt: 1,
          error: 'transient purchase write failed',
          maxAttempts: 3,
          transactionId: 'vtu-1',
        })
      );
    } finally {
      consoleWarnSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it('returns success when final success metadata cannot be persisted', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
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
        network_provider: 'MTN',
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
      updateErrors: {
        finalMetadata: { message: 'final metadata write failed' },
      },
    });

    try {
      const result = await fulfillPendingVtuTransaction({
        supabase,
        transactionId: 'vtu-1',
      });

      expect(result).toMatchObject({
        amount: 1000,
        reference: 'VTU-123',
        status: 'successful',
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to persist final VTU transaction metadata:',
        expect.objectContaining({
          error: 'final metadata write failed',
          transactionId: 'vtu-1',
        })
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('backfills a missing electricity token from Kuda bill status', async () => {
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
    expect(supabase.rpc).toHaveBeenCalledWith(
      'set_vtu_transaction_voucher_pin',
      {
        p_transaction_id: 'vtu-1',
        p_voucher_pin: '1234-5678-9012',
      }
    );
  });

  describe('refund-to-wallet on failed vend', () => {
    const FAILED_ROW_BASE = {
      id: 'vtu-1',
      merchant_id: 'merchant-1',
      customer_id: 'customer-1',
      type: 'electricity' as const,
      network_provider: 'EKEDC NG',
      phone_number: '08012345678',
      amount: 1000,
      request_reference: 'VTU-123',
      transaction_id: 'kuda-ref-1',
      error_message: 'Vend rejected (biller status: k11)',
      merchant_commission: 10,
      customer_cashback: 50,
      biller_name: 'EKEDC NG - EKEDC PREPAID',
      biller_item_code: 'KUD-ELE-EKED-002',
      customer_identifier: '43901766923',
      source: 'checkout' as const,
    };

    it('refunds the customer wallet when an already-failed row is replayed', async () => {
      const updatePayloads: unknown[] = [];
      const rpcImpl = vi.fn((name: string) =>
        Promise.resolve(
          name === 'refund_customer_wallet_for_vtu'
            ? {
                data: [
                  {
                    success: true,
                    new_balance: 1050,
                    transaction_id: 'ledger-1',
                  },
                ],
                error: null,
              }
            : { data: null, error: null }
        )
      );

      const supabase = createPendingTransactionSupabaseMock({
        transactionRow: {
          ...FAILED_ROW_BASE,
          status: 'failed',
          metadata: { paymentReference: 'VTU-PAYSTACK-123' },
        },
        rpcImpl,
        updatePayloads,
      });

      const result = await fulfillPendingVtuTransaction({
        retryFailed: false,
        supabase,
        transactionId: 'vtu-1',
      });

      expect(result).toMatchObject({
        amount: 1000,
        error: 'Vend rejected (biller status: k11)',
        reference: 'VTU-123',
        refundedToWallet: 1000,
        status: 'failed',
      });
      expect(rpcImpl).toHaveBeenCalledWith('refund_customer_wallet_for_vtu', {
        p_amount: 1000,
        p_customer_id: 'customer-1',
        p_description: expect.any(String),
        p_merchant_id: 'merchant-1',
        p_vtu_transaction_id: 'vtu-1',
      });
      const refundMetadataPayload = findPayloadWithMetadata(
        updatePayloads,
        (metadata) => metadata.refundIssued === true
      );
      expect(refundMetadataPayload?.metadata).toMatchObject({
        refundAmount: 1000,
        refundIssued: true,
      });
    });

    it('skips the refund when the row has no customer_id', async () => {
      const rpcImpl = vi.fn(() => Promise.resolve({ data: null, error: null }));
      const supabase = createPendingTransactionSupabaseMock({
        transactionRow: {
          ...FAILED_ROW_BASE,
          customer_id: null,
          status: 'failed',
          metadata: {},
        },
        rpcImpl,
      });

      const result = await fulfillPendingVtuTransaction({
        retryFailed: false,
        supabase,
        transactionId: 'vtu-1',
      });

      expect(result).toMatchObject({ status: 'failed' });
      expect(result).not.toHaveProperty('refundedToWallet');
      expect(rpcImpl).not.toHaveBeenCalledWith(
        'refund_customer_wallet_for_vtu',
        expect.anything()
      );
    });

    it('skips the refund for non-checkout sources (e.g. loyalty_reward)', async () => {
      // loyalty_reward, gift, direct, storefront_modal — none of these
      // collect customer money, so there's nothing to refund.
      const rpcImpl = vi.fn(() => Promise.resolve({ data: null, error: null }));
      const supabase = createPendingTransactionSupabaseMock({
        transactionRow: {
          ...FAILED_ROW_BASE,
          source: 'loyalty_reward',
          status: 'failed',
          metadata: {},
        },
        rpcImpl,
      });

      const result = await fulfillPendingVtuTransaction({
        retryFailed: false,
        supabase,
        transactionId: 'vtu-1',
      });

      expect(result).toMatchObject({ status: 'failed' });
      expect(result).not.toHaveProperty('refundedToWallet');
      expect(rpcImpl).not.toHaveBeenCalledWith(
        'refund_customer_wallet_for_vtu',
        expect.anything()
      );
    });

    it('refunds checkout-sourced rows even when paymentReference is absent (saved-card path)', async () => {
      // Regression: an earlier draft gated on metadata.paymentReference,
      // but the saved-card charge path stores that on the transactions row
      // only — vtu_transactions.metadata has no paymentReference there.
      // Gating on row.source === 'checkout' covers both flows.
      const rpcImpl = vi.fn((name: string) =>
        Promise.resolve(
          name === 'refund_customer_wallet_for_vtu'
            ? {
                data: [
                  {
                    success: true,
                    new_balance: 1050,
                    transaction_id: 'ledger-saved-card',
                  },
                ],
                error: null,
              }
            : { data: null, error: null }
        )
      );
      const supabase = createPendingTransactionSupabaseMock({
        transactionRow: {
          ...FAILED_ROW_BASE,
          status: 'failed',
          metadata: {}, // saved-card path leaves vtu_transactions.metadata empty
        },
        rpcImpl,
      });

      const result = await fulfillPendingVtuTransaction({
        retryFailed: false,
        supabase,
        transactionId: 'vtu-1',
      });

      expect(result).toMatchObject({
        refundedToWallet: 1000,
        status: 'failed',
      });
      expect(rpcImpl).toHaveBeenCalledWith(
        'refund_customer_wallet_for_vtu',
        expect.objectContaining({ p_amount: 1000 })
      );
    });

    it('reports the prior refund without re-calling the RPC when metadata.refundIssued is already true', async () => {
      const rpcImpl = vi.fn(() => Promise.resolve({ data: null, error: null }));
      const supabase = createPendingTransactionSupabaseMock({
        transactionRow: {
          ...FAILED_ROW_BASE,
          status: 'failed',
          metadata: {
            paymentReference: 'VTU-PAYSTACK-123',
            refundIssued: true,
            refundAmount: 1000,
          },
        },
        rpcImpl,
      });

      const result = await fulfillPendingVtuTransaction({
        retryFailed: false,
        supabase,
        transactionId: 'vtu-1',
      });

      expect(result).toMatchObject({
        refundedToWallet: 1000,
        status: 'failed',
      });
      expect(rpcImpl).not.toHaveBeenCalledWith(
        'refund_customer_wallet_for_vtu',
        expect.anything()
      );
    });

    it('refuses to retry a row that has already been refunded (prevents double-credit)', async () => {
      // Once metadata.refundIssued is true, retryFailed must NOT execute a
      // second vend attempt: if it succeeded, the customer would keep both
      // the wallet refund AND the successful vend.
      const rpcImpl = vi.fn(() => Promise.resolve({ data: null, error: null }));
      const supabase = createPendingTransactionSupabaseMock({
        transactionRow: {
          ...FAILED_ROW_BASE,
          status: 'failed',
          metadata: {
            refundIssued: true,
            refundAmount: 1000,
            refundedAt: '2026-05-05T08:00:00.000Z',
          },
        },
        rpcImpl,
      });

      const result = await fulfillPendingVtuTransaction({
        retryFailed: true, // /api/vtu/checkout/confirm passes this
        supabase,
        transactionId: 'vtu-1',
      });

      expect(result).toMatchObject({
        amount: 1000,
        reference: 'VTU-123',
        refundedToWallet: 1000,
        status: 'failed',
      });
      // No reconciliation, no retry, no purchase mock invocation.
      expect(mockCheckTransactionStatus).not.toHaveBeenCalled();
      expect(mockPurchaseAirtime).not.toHaveBeenCalled();
      expect(mockPurchaseData).not.toHaveBeenCalled();
      expect(mockPurchaseBill).not.toHaveBeenCalled();
    });

    it('blocks retry via the ledger when refundIssued metadata is missing but a refund row exists', async () => {
      // Models the crash-between-RPC-and-metadata-write case: the wallet
      // was credited in a prior fulfillment, but the metadata update failed
      // so refundIssued !== true on this row. The retry path must consult
      // the ledger and refuse to re-vend.
      const supabaseLedgerSelect = {
        eq: vi.fn(() => supabaseLedgerSelect),
        order: vi.fn(() => supabaseLedgerSelect),
        limit: vi.fn(() => supabaseLedgerSelect),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { amount: 1000 },
          error: null,
        }),
      };
      const transactionRow = {
        ...FAILED_ROW_BASE,
        status: 'failed',
        metadata: {}, // metadata write previously failed; refundIssued absent
      };
      const supabase = {
        from: vi.fn((table: string) => {
          if (table === 'vtu_transactions') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({
                    data: transactionRow,
                    error: null,
                  }),
                })),
              })),
            };
          }
          if (table === 'customer_wallet_transactions') {
            return { select: vi.fn(() => supabaseLedgerSelect) };
          }
          return { select: vi.fn() };
        }),
        rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
      } as unknown as SupabaseStub;

      const result = await fulfillPendingVtuTransaction({
        retryFailed: true,
        supabase,
        transactionId: 'vtu-1',
      });

      expect(result).toMatchObject({
        amount: 1000,
        refundedToWallet: 1000,
        status: 'failed',
      });
      expect(mockCheckTransactionStatus).not.toHaveBeenCalled();
      expect(mockPurchaseAirtime).not.toHaveBeenCalled();
      expect(mockPurchaseBill).not.toHaveBeenCalled();
    });

    it('throws VtuPersistenceError when refund RPC succeeded but metadata persistence fails', async () => {
      // Fail-closed: the wallet was credited, but writing refundIssued=true
      // back to vtu_transactions failed. Returning success here would let a
      // later retry miss the cached flag (and the ledger source-of-truth on
      // the retry path is the second line of defence). Surface the error so
      // the next request retries the metadata write.
      const rpcImpl = vi.fn((name: string) =>
        Promise.resolve(
          name === 'refund_customer_wallet_for_vtu'
            ? {
                data: [
                  {
                    success: true,
                    new_balance: 1050,
                    transaction_id: 'ledger-x',
                  },
                ],
                error: null,
              }
            : { data: null, error: null }
        )
      );
      const supabase = createPendingTransactionSupabaseMock({
        transactionRow: {
          ...FAILED_ROW_BASE,
          status: 'failed',
          metadata: {},
        },
        rpcImpl,
        updateErrors: {
          finalMetadata: { message: 'metadata write failed' },
        },
      });

      await expect(
        fulfillPendingVtuTransaction({
          retryFailed: false,
          supabase,
          transactionId: 'vtu-1',
        })
      ).rejects.toThrow(/Failed to persist VTU refund metadata/);
      // RPC must have been called even though we throw afterwards — the
      // ledger row exists, so the next attempt (via the retryFailed path)
      // will find it.
      expect(rpcImpl).toHaveBeenCalledWith(
        'refund_customer_wallet_for_vtu',
        expect.anything()
      );
    });

    it('returns failed without refundedToWallet when the refund RPC errors', async () => {
      const rpcImpl = vi.fn((name: string) =>
        Promise.resolve(
          name === 'refund_customer_wallet_for_vtu'
            ? { data: null, error: { message: 'database is down' } }
            : { data: null, error: null }
        )
      );
      const supabase = createPendingTransactionSupabaseMock({
        transactionRow: {
          ...FAILED_ROW_BASE,
          status: 'failed',
          metadata: { paymentReference: 'VTU-PAYSTACK-123' },
        },
        rpcImpl,
      });

      const result = await fulfillPendingVtuTransaction({
        retryFailed: false,
        supabase,
        transactionId: 'vtu-1',
      });

      expect(result).toMatchObject({ status: 'failed' });
      expect(result).not.toHaveProperty('refundedToWallet');
      expect(rpcImpl).toHaveBeenCalledWith(
        'refund_customer_wallet_for_vtu',
        expect.anything()
      );
    });
  });
});
