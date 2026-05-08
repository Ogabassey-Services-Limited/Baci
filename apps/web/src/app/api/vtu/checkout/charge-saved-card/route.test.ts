import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuthenticateApiRequest = vi.fn();
const mockPreparePendingVtuTransaction = vi.fn();
const mockGetSavedPaymentMethodById = vi.fn();
const mockChargeAuthorization = vi.fn();
const mockFulfillPendingVtuTransaction = vi.fn();
const mockUpsertPaystackAuthorization = vi.fn();
const mockFrom = vi.fn();
const transactionsInsertCalls: Record<string, unknown>[] = [];
const updateCalls: Array<{
  eqColumn: string;
  eqValue: unknown;
  table: string;
  values: Record<string, unknown>;
}> = [];
let updateErrorFor: (input: {
  eqColumn: string;
  eqValue: unknown;
  table: string;
  values: Record<string, unknown>;
}) => Error | null = () => null;

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) =>
    mockAuthenticateApiRequest(...args),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn(() =>
    Promise.resolve({ valid: true, response: null })
  ),
}));

vi.mock('@/lib/vtu-pending-transaction', () => ({
  preparePendingVtuTransaction: (...args: unknown[]) =>
    mockPreparePendingVtuTransaction(...args),
}));

vi.mock('@/lib/customer-saved-payment-methods', () => ({
  getSavedPaymentMethodById: (...args: unknown[]) =>
    mockGetSavedPaymentMethodById(...args),
  upsertPaystackAuthorization: (...args: unknown[]) =>
    mockUpsertPaystackAuthorization(...args),
}));

vi.mock('@/lib/paystack', () => ({
  chargeAuthorization: (...args: unknown[]) => mockChargeAuthorization(...args),
}));

vi.mock('@/lib/vtu-fulfillment', () => ({
  fulfillPendingVtuTransaction: (...args: unknown[]) =>
    mockFulfillPendingVtuTransaction(...args),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

import { POST } from './route';

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest(
    'http://localhost:3000/api/vtu/checkout/charge-saved-card',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
}

describe('POST /api/vtu/checkout/charge-saved-card', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticateApiRequest.mockResolvedValue({
      user: { id: 'user-1', email: 'customer@example.com' },
      error: null,
      supabase: {},
    });
    mockPreparePendingVtuTransaction.mockResolvedValue({
      customer: {
        id: 'customer-1',
        email: 'customer@example.com',
        first_name: 'Ada',
        last_name: 'Lovelace',
      },
      merchant: {
        id: 'merchant-1',
        slug: 'ogabassey',
      },
      transaction: {
        id: 'vtu-1',
        type: 'airtime',
      },
    });
    mockGetSavedPaymentMethodById.mockResolvedValue({
      id: 'card-1',
      provider_customer_email: 'customer@example.com',
      authorization_code: 'AUTH_123',
    });
    mockChargeAuthorization.mockResolvedValue({
      success: true,
      data: {
        status: 'success',
        reference: 'VTU-123',
        authorization: {
          authorization_code: 'AUTH_123',
          card_type: 'visa DEBIT',
          last4: '1234',
          exp_month: '08',
          exp_year: '2030',
          bank: 'Access Bank',
          channel: 'card',
          signature: 'SIG_123',
          reusable: true,
          country_code: 'NG',
        },
      },
    });
    mockFulfillPendingVtuTransaction.mockResolvedValue({
      status: 'successful',
      amount: 1000,
      reference: 'VTU-123',
    });
    updateErrorFor = () => null;
    transactionsInsertCalls.length = 0;
    updateCalls.length = 0;
    mockFrom.mockImplementation((table: string) => ({
      insert: vi.fn((row: Record<string, unknown>) => {
        if (table === 'transactions') {
          transactionsInsertCalls.push(row);
        }
        return Promise.resolve({ error: null });
      }),
      update: vi.fn((values: Record<string, unknown>) => ({
        eq: vi.fn((eqColumn: string, eqValue: unknown) => {
          updateCalls.push({ eqColumn, eqValue, table, values });
          return Promise.resolve({
            error: updateErrorFor({ eqColumn, eqValue, table, values }),
          });
        }),
      })),
    }));
  });

  it('returns a hosted authorization flow when Paystack pauses the charge', async () => {
    mockChargeAuthorization.mockResolvedValue({
      success: true,
      data: {
        paused: true,
        authorization_url: 'https://paystack.com/pay/auth',
        gateway_response: null,
        reference: 'VTU-123',
        status: 'pending',
      },
    });

    const response = await POST(
      makeRequest({
        merchantSlug: 'ogabassey',
        amount: 1000,
        gateway: 'paystack',
        savedPaymentMethodId: '550e8400-e29b-41d4-a716-446655440000',
        type: 'airtime',
        phoneNumber: '08012345678',
        networkProvider: 'MTN',
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      requires_authorization: true,
      authorization_url: 'https://paystack.com/pay/auth',
    });
  });

  it('returns processing when Paystack accepts the saved-card charge but has not completed it yet', async () => {
    mockChargeAuthorization.mockResolvedValue({
      success: true,
      data: {
        gateway_response: 'Pending',
        reference: 'VTU-123',
        status: 'pending',
      },
    });

    const response = await POST(
      makeRequest({
        merchantSlug: 'ogabassey',
        amount: 1000,
        gateway: 'paystack',
        savedPaymentMethodId: '550e8400-e29b-41d4-a716-446655440000',
        type: 'airtime',
        phoneNumber: '08012345678',
        networkProvider: 'MTN',
      })
    );
    const data = await response.json();

    expect(response.status).toBe(202);
    expect(data).toMatchObject({
      gateway: 'paystack',
      reference: expect.stringMatching(/^VTU-[A-Z0-9]{12}$/),
      status: 'processing',
    });
    expect(mockFulfillPendingVtuTransaction).not.toHaveBeenCalled();
  });

  it('marks the payment and VTU rows failed when Paystack rejects the saved-card charge', async () => {
    mockChargeAuthorization.mockResolvedValue({
      success: true,
      data: {
        gateway_response: 'Insufficient funds',
        reference: 'VTU-123',
        status: 'failed',
      },
    });

    const response = await POST(
      makeRequest({
        merchantSlug: 'ogabassey',
        amount: 1000,
        gateway: 'paystack',
        savedPaymentMethodId: '550e8400-e29b-41d4-a716-446655440000',
        type: 'airtime',
        phoneNumber: '08012345678',
        networkProvider: 'MTN',
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toMatchObject({ error: 'Insufficient funds' });
    expect(mockFulfillPendingVtuTransaction).not.toHaveBeenCalled();
    expect(updateCalls).toContainEqual(
      expect.objectContaining({
        eqColumn: 'gateway_reference',
        table: 'transactions',
        values: expect.objectContaining({
          gateway_response: expect.objectContaining({
            gateway_response: 'Insufficient funds',
            status: 'failed',
          }),
          status: 'failed',
        }),
      })
    );
    expect(updateCalls).toContainEqual(
      expect.objectContaining({
        eqColumn: 'id',
        eqValue: 'vtu-1',
        table: 'vtu_transactions',
        values: {
          error_message: 'Insufficient funds',
          status: 'failed',
        },
      })
    );
  });

  it('returns 500 when the Paystack failure payment-row update cannot be persisted', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    updateErrorFor = ({ table }) =>
      table === 'transactions' ? new Error('transaction update failed') : null;
    mockChargeAuthorization.mockResolvedValue({
      success: true,
      data: {
        gateway_response: 'Insufficient funds',
        reference: 'VTU-123',
        status: 'failed',
      },
    });

    const response = await POST(
      makeRequest({
        merchantSlug: 'ogabassey',
        amount: 1000,
        gateway: 'paystack',
        savedPaymentMethodId: '550e8400-e29b-41d4-a716-446655440000',
        type: 'airtime',
        phoneNumber: '08012345678',
        networkProvider: 'MTN',
      })
    );
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toMatchObject({
      error: expect.stringMatching(/could not update the transaction status/i),
    });
    expect(updateCalls).toContainEqual(
      expect.objectContaining({
        table: 'vtu_transactions',
        values: {
          error_message: 'Insufficient funds',
          status: 'failed',
        },
      })
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to persist saved-card payment failure state',
      expect.objectContaining({
        paymentError: 'Insufficient funds',
        transactionUpdateError: 'transaction update failed',
      })
    );
  });

  it('returns 500 when the Paystack failure VTU-row update cannot be persisted', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    updateErrorFor = ({ table }) =>
      table === 'vtu_transactions'
        ? new Error('vtu transaction update failed')
        : null;
    mockChargeAuthorization.mockResolvedValue({
      success: true,
      data: {
        gateway_response: 'Insufficient funds',
        reference: 'VTU-123',
        status: 'failed',
      },
    });

    const response = await POST(
      makeRequest({
        merchantSlug: 'ogabassey',
        amount: 1000,
        gateway: 'paystack',
        savedPaymentMethodId: '550e8400-e29b-41d4-a716-446655440000',
        type: 'airtime',
        phoneNumber: '08012345678',
        networkProvider: 'MTN',
      })
    );
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toMatchObject({
      error: expect.stringMatching(/could not update the transaction status/i),
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to persist saved-card payment failure state',
      expect.objectContaining({
        paymentError: 'Insufficient funds',
        vtuTransactionUpdateError: 'vtu transaction update failed',
      })
    );
  });

  it('returns the fulfilled VTU purchase when the saved-card charge succeeds', async () => {
    const response = await POST(
      makeRequest({
        merchantSlug: 'ogabassey',
        amount: 1000,
        gateway: 'paystack',
        savedPaymentMethodId: '550e8400-e29b-41d4-a716-446655440000',
        type: 'airtime',
        phoneNumber: '08012345678',
        networkProvider: 'MTN',
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      success: true,
      status: 'successful',
      amount: 1000,
      reference: 'VTU-123',
    });
    expect(mockUpsertPaystackAuthorization).toHaveBeenCalled();
    expect(mockFulfillPendingVtuTransaction).toHaveBeenCalledWith({
      supabase: expect.any(Object),
      transactionId: 'vtu-1',
    });
  });

  it('returns the payment reference when saved-card fulfillment is still processing', async () => {
    mockFulfillPendingVtuTransaction.mockResolvedValue({
      status: 'processing',
      reference: 'KUDA-REQ-123',
    });

    const response = await POST(
      makeRequest({
        merchantSlug: 'ogabassey',
        amount: 1000,
        gateway: 'paystack',
        savedPaymentMethodId: '550e8400-e29b-41d4-a716-446655440000',
        type: 'airtime',
        phoneNumber: '08012345678',
        networkProvider: 'MTN',
      })
    );
    const data = await response.json();

    expect(response.status).toBe(202);
    expect(data).toMatchObject({
      gateway: 'paystack',
      reference: expect.stringMatching(/^VTU-[A-Z0-9]{12}$/),
      status: 'processing',
    });
    expect(data.reference).not.toBe('KUDA-REQ-123');
  });

  it('keeps the saved-card charge processing when post-charge VTU fulfillment fails', async () => {
    const consoleWarnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    mockFulfillPendingVtuTransaction.mockResolvedValue({
      error: 'Provider vend is not ready',
      reference: 'KUDA-REQ-123',
      refundedToWallet: 1000,
      status: 'failed',
    });

    const response = await POST(
      makeRequest({
        merchantSlug: 'ogabassey',
        amount: 1000,
        gateway: 'paystack',
        savedPaymentMethodId: '550e8400-e29b-41d4-a716-446655440000',
        type: 'airtime',
        phoneNumber: '08012345678',
        networkProvider: 'MTN',
      })
    );
    const data = await response.json();

    expect(response.status).toBe(202);
    expect(data).toMatchObject({
      gateway: 'paystack',
      mayRequireManualCheck: true,
      message: expect.stringMatching(/transaction history/i),
      providerReference: 'KUDA-REQ-123',
      reference: expect.stringMatching(/^VTU-[A-Z0-9]{12}$/),
      refundedToWallet: 1000,
      status: 'processing',
    });
    expect(consoleWarnSpy).toHaveBeenCalled();
  });

  it('keeps the saved-card charge processing when post-charge VTU fulfillment throws', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockFulfillPendingVtuTransaction.mockRejectedValue(
      new Error('Kuda timeout')
    );

    const response = await POST(
      makeRequest({
        merchantSlug: 'ogabassey',
        amount: 1000,
        gateway: 'paystack',
        savedPaymentMethodId: '550e8400-e29b-41d4-a716-446655440000',
        type: 'airtime',
        phoneNumber: '08012345678',
        networkProvider: 'MTN',
      })
    );
    const data = await response.json();

    expect(response.status).toBe(202);
    expect(data).toMatchObject({
      gateway: 'paystack',
      reference: expect.stringMatching(/^VTU-[A-Z0-9]{12}$/),
      status: 'processing',
    });
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  // Phase B.7 — wallet residual coverage on saved-card charge.

  it('passes through unchanged when walletAmount is 0', async () => {
    const response = await POST(
      makeRequest({
        merchantSlug: 'ogabassey',
        amount: 1000,
        walletAmount: 0,
        gateway: 'paystack',
        savedPaymentMethodId: '550e8400-e29b-41d4-a716-446655440000',
        type: 'airtime',
        phoneNumber: '08012345678',
        networkProvider: 'MTN',
      })
    );

    expect(response.status).toBe(200);
    expect(mockChargeAuthorization).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 1000 * 100 })
    );
    expect(transactionsInsertCalls[0]).toMatchObject({ amount: 1000 });
  });

  it('rejects walletAmount === amount and directs the client to the wallet-only route', async () => {
    const response = await POST(
      makeRequest({
        merchantSlug: 'ogabassey',
        amount: 1000,
        walletAmount: 1000,
        gateway: 'paystack',
        savedPaymentMethodId: '550e8400-e29b-41d4-a716-446655440000',
        type: 'airtime',
        phoneNumber: '08012345678',
        networkProvider: 'MTN',
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toMatchObject({
      error: expect.stringMatching(/wallet-only/i),
    });
    expect(mockChargeAuthorization).not.toHaveBeenCalled();
    expect(transactionsInsertCalls).toHaveLength(0);
    expect(mockFulfillPendingVtuTransaction).not.toHaveBeenCalled();
  });

  it('charges only the residual on the saved card when walletAmount < amount, and fulfillment runs after', async () => {
    const response = await POST(
      makeRequest({
        merchantSlug: 'ogabassey',
        amount: 1000,
        walletAmount: 400,
        gateway: 'paystack',
        savedPaymentMethodId: '550e8400-e29b-41d4-a716-446655440000',
        type: 'airtime',
        phoneNumber: '08012345678',
        networkProvider: 'MTN',
      })
    );

    expect(response.status).toBe(200);
    expect(mockChargeAuthorization).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 600 * 100 })
    );
    expect(transactionsInsertCalls[0]).toMatchObject({
      amount: 600,
      currency: 'NGN',
      gateway: 'paystack',
      status: 'pending',
    });
    // Fulfillment STILL runs — Phase B.5 reads paymentSplit from
    // vtu_transactions.metadata and debits the wallet leg there.
    expect(mockFulfillPendingVtuTransaction).toHaveBeenCalledWith({
      supabase: expect.any(Object),
      transactionId: 'vtu-1',
    });
  });
});
