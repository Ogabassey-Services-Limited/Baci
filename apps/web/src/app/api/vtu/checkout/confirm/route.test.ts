import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuthenticateApiRequest = vi.fn();
const mockVerifyPaystackTransaction = vi.fn();
const mockUpsertPaystackAuthorization = vi.fn();
const mockFulfillPendingVtuTransaction = vi.fn();
const mockResolveVtuCustomer = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) =>
    mockAuthenticateApiRequest(...args),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn(() =>
    Promise.resolve({ valid: true, response: null })
  ),
}));

vi.mock('@/lib/paystack', () => ({
  verifyTransaction: (...args: unknown[]) =>
    mockVerifyPaystackTransaction(...args),
}));

vi.mock('@/lib/korapay', () => ({
  verifyPayment: vi.fn(),
}));

vi.mock('@/lib/customer-saved-payment-methods', () => ({
  upsertPaystackAuthorization: (...args: unknown[]) =>
    mockUpsertPaystackAuthorization(...args),
}));

vi.mock('@/lib/vtu-fulfillment', () => ({
  fulfillPendingVtuTransaction: (...args: unknown[]) =>
    mockFulfillPendingVtuTransaction(...args),
}));

vi.mock('@/lib/vtu-pending-transaction', () => ({
  resolveVtuCustomer: (...args: unknown[]) => mockResolveVtuCustomer(...args),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

import { POST } from './route';

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/vtu/checkout/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const defaultPaymentTransaction = {
  id: 'txn-1',
  amount: 1000,
  currency: 'NGN',
  status: 'pending',
  merchant_id: 'merchant-1',
  metadata: {
    transaction_type: 'vtu_purchase',
    vtu_transaction_id: 'vtu-1',
    customer_id: 'customer-1',
    customer_email: 'customer@example.com',
  },
};

type PaymentTransaction = typeof defaultPaymentTransaction;
type PaymentUpdateResult = {
  data: Pick<PaymentTransaction, 'id'> | null;
  error: unknown;
};

function createMockFrom({
  transactionError = null,
  transactionData = defaultPaymentTransaction,
  updateResult = { data: { id: 'txn-1' }, error: null },
}: {
  transactionError?: unknown;
  transactionData?: PaymentTransaction | null;
  updateResult?: PaymentUpdateResult;
} = {}) {
  return (table: string) => {
    if (table === 'merchants') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'merchant-1' },
              error: null,
            }),
          }),
        }),
      };
    }

    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: transactionData,
            error: transactionError,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          neq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue(updateResult),
            }),
          }),
        }),
      }),
    };
  };
}

describe('POST /api/vtu/checkout/confirm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticateApiRequest.mockResolvedValue({
      user: { id: 'user-1', email: 'customer@example.com' },
      error: null,
      supabase: {},
    });
    mockVerifyPaystackTransaction.mockResolvedValue({
      success: true,
      data: {
        amount: 100000,
        status: 'success',
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
    mockResolveVtuCustomer.mockResolvedValue({ id: 'customer-1' });
    mockFrom.mockImplementation(createMockFrom());
  });

  it('returns 404 when the payment transaction does not exist', async () => {
    mockFrom.mockImplementation(createMockFrom({ transactionData: null }));

    const response = await POST(
      makeRequest({
        merchantSlug: 'ogabassey',
        gateway: 'paystack',
        reference: 'VTU-123',
      })
    );

    expect(response.status).toBe(404);
  });

  it('confirms payment, stores the reusable card, and fulfills VTU', async () => {
    const response = await POST(
      makeRequest({
        merchantSlug: 'ogabassey',
        gateway: 'paystack',
        reference: 'VTU-123',
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      success: true,
      status: 'successful',
      reference: 'VTU-123',
      amount: 1000,
    });
    expect(mockUpsertPaystackAuthorization).toHaveBeenCalled();
    expect(mockFulfillPendingVtuTransaction).toHaveBeenCalledWith({
      retryFailed: true,
      supabase: expect.any(Object),
      transactionId: 'vtu-1',
    });
  });

  it('continues to VTU fulfillment when another process already claimed the payment', async () => {
    mockFrom.mockImplementation(
      createMockFrom({ updateResult: { data: null, error: null } })
    );

    const response = await POST(
      makeRequest({
        merchantSlug: 'ogabassey',
        gateway: 'paystack',
        reference: 'VTU-123',
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      status: 'successful',
      reference: 'VTU-123',
    });
    expect(mockFulfillPendingVtuTransaction).toHaveBeenCalledWith({
      retryFailed: true,
      supabase: expect.any(Object),
      transactionId: 'vtu-1',
    });
  });
});
