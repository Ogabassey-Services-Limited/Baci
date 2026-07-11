import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { filePaypalCapturePersistFailureReview } from '@/lib/payments/file-paypal-capture-persist-failure-review';
import { loadPaypalCaptureContext } from '@/lib/payments/load-paypal-capture-context';
import {
  getDecryptedMerchantCredential,
  markMerchantCredentialInvalid,
} from '@/lib/payments/merchant-credentials';
import { runPaypalCaptureSideEffects } from '@/lib/payments/paypal-capture-side-effects';
import { captureOrder, detectPayPalResponseMode } from '@/lib/paypal';
import { createServiceClient } from '@/lib/supabase/service';
import { POST } from './route';

vi.mock('server-only', () => ({}));

vi.mock('next/server', async () => {
  const actual =
    await vi.importActual<typeof import('next/server')>('next/server');
  return { ...actual, after: vi.fn((fn: () => unknown) => fn()) };
});

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }));

vi.mock('@/lib/paypal', () => ({
  captureOrder: vi.fn(),
  detectPayPalResponseMode: vi.fn(),
}));

vi.mock('@/lib/payments/merchant-credentials', () => ({
  getDecryptedMerchantCredential: vi.fn(),
  markMerchantCredentialInvalid: vi.fn(),
}));

vi.mock('@/lib/payments/load-paypal-capture-context', () => ({
  loadPaypalCaptureContext: vi.fn(),
  orderNumberFallback: (id: string) => id.slice(0, 8).toUpperCase(),
}));

vi.mock('@/lib/payments/paypal-capture-side-effects', () => ({
  runPaypalCaptureSideEffects: vi.fn(),
}));

vi.mock('@/lib/payments/file-paypal-capture-persist-failure-review', () => ({
  filePaypalCapturePersistFailureReview: vi.fn(),
}));

// finalizePaypalCaptureOrder runs for real here so the route wiring is exercised
// end-to-end; its inventory dependency is stubbed to the confirm-success path.
vi.mock('@/lib/payments/ensure-paid-order-inventory-confirmed', () => ({
  ensurePaidOrderInventoryConfirmed: vi.fn().mockResolvedValue(undefined),
  isSerializedInventoryUnavailableError: vi.fn(() => false),
  rollbackOrderStatusAfterInventoryConfirmationFailure: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const MERCHANT_ID = '123e4567-e89b-12d3-a456-426614174000';
const ORDER_ID = '123e4567-e89b-12d3-a456-426614174111';
const PAYPAL_ORDER_ID = 'PP-ORD-1';

const META = {
  customer_email: 'customer@example.com',
  paypal_presentment_amount: 100,
  paypal_presentment_currency: 'USD',
  // Customer checkout is live-only (F10); the capture route reads the order's
  // original mode from transaction metadata, so the happy-path fixture is live.
  paypal_mode: 'live',
};

const DEFAULT_ORDER = {
  id: ORDER_ID,
  order_number: 'BACI-1002',
  customer_id: 'c1',
  total: 130000,
  subtotal: 120000,
  shipping_fee: 10000,
  customer_name: 'Ada',
  customer_email: 'customer@example.com',
  customer_phone: '0800',
  shipping_address: {},
  currency: 'NGN',
  order_items: [],
};

function proceedContext() {
  return {
    proceed: true,
    reconcileOnly: false,
    transaction: {
      id: 'txn-1',
      order_id: ORDER_ID,
      merchant_id: MERCHANT_ID,
      amount: 130000,
      currency: 'NGN',
      status: 'pending',
      metadata: META,
      platform_fee: 0,
    },
    orderSnapshot: {
      id: ORDER_ID,
      merchant_id: MERCHANT_ID,
      total: 130000,
      currency: 'NGN',
      customer_email: 'customer@example.com',
      order_number: 'BACI-1002',
      shipping_status: 'pending',
      payment_status: 'unpaid',
    },
    metadata: META,
  };
}

function captureData(
  captures: {
    id: string;
    status: string;
    amount: { value: string; currency_code: string };
  }[] = [
    {
      id: 'cap-1',
      status: 'COMPLETED',
      amount: { value: '100.00', currency_code: 'USD' },
    },
  ]
) {
  return {
    id: 'CAP',
    status: 'COMPLETED' as const,
    purchase_units: [{ payments: { captures } }],
    links: [
      {
        href: 'https://api-m.sandbox.paypal.com/v2/checkout/orders/PP-ORD-1',
        rel: 'self',
        method: 'GET',
      },
    ],
  };
}

function buildServiceMock({
  custom = { paypal_enabled: true, paypal_mode: 'live' } as Record<
    string,
    unknown
  >,
  updatedTxn = { data: { id: 'txn-1' }, error: null } as {
    data: unknown;
    error: unknown;
  },
  orderResult = { data: DEFAULT_ORDER, error: null } as {
    data: unknown;
    error: unknown;
  },
} = {}) {
  let lastTable = '';
  const mock = {
    from: vi.fn((t: string) => {
      lastTable = t;
      return mock;
    }),
    select: vi.fn(() => mock),
    eq: vi.fn(() => mock),
    update: vi.fn(() => mock),
    single: vi.fn(() => {
      if (lastTable === 'merchant_feature_settings') {
        return Promise.resolve({
          data: { custom_settings: custom },
          error: null,
        });
      }
      if (lastTable === 'orders') {
        return Promise.resolve(orderResult);
      }
      return Promise.resolve({ data: null, error: null });
    }),
    maybeSingle: vi.fn(() => {
      if (lastTable === 'transactions') {
        return Promise.resolve(updatedTxn);
      }
      return Promise.resolve({ data: null, error: null });
    }),
  };
  return mock;
}

function createRequest(bodyOverrides: Record<string, unknown> = {}) {
  return new NextRequest(
    'https://example.com/api/payments/paypal/capture-order',
    {
      method: 'POST',
      body: JSON.stringify({
        order_id: ORDER_ID,
        paypal_order_id: PAYPAL_ORDER_ID,
        customer_email: 'customer@example.com',
        merchant_id: MERCHANT_ID,
        ...bodyOverrides,
      }),
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

function mockVaultOk() {
  vi.mocked(getDecryptedMerchantCredential).mockImplementation(
    async (_merchant, _provider, role) =>
      role === 'client_id' ? 'mock-client-id' : 'mock-secret-key'
  );
}

describe('POST /api/payments/paypal/capture-order', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadPaypalCaptureContext).mockResolvedValue(
      proceedContext() as never
    );
    vi.mocked(createServiceClient).mockReturnValue(buildServiceMock() as never);
    vi.mocked(captureOrder).mockResolvedValue({
      success: true,
      data: captureData(),
    });
    vi.mocked(detectPayPalResponseMode).mockReturnValue('live');
    mockVaultOk();
  });

  it('returns 400 for an invalid payload', async () => {
    const response = await POST(
      new NextRequest('https://example.com', {
        method: 'POST',
        body: JSON.stringify({}),
      })
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('Invalid input parameters');
  });

  it('passes a context rejection straight through', async () => {
    vi.mocked(loadPaypalCaptureContext).mockResolvedValue({
      proceed: false,
      status: 404,
      body: { error: 'Transaction not found for this reference' },
    });

    const response = await POST(createRequest());
    expect(response.status).toBe(404);
    expect((await response.json()).error).toBe(
      'Transaction not found for this reference'
    );
  });

  it('rejects a sandbox-environment order with 400 PAYPAL_SANDBOX_NOT_ALLOWED before capturing', async () => {
    // The order's stored mode is sandbox (or missing) — a sandbox capture could
    // mark the order paid with no real funds, so refuse before hitting PayPal or
    // the credential vault (F10).
    const base = proceedContext();
    vi.mocked(loadPaypalCaptureContext).mockResolvedValue({
      ...base,
      metadata: { ...META, paypal_mode: 'sandbox' },
      transaction: {
        ...base.transaction,
        metadata: { ...META, paypal_mode: 'sandbox' },
      },
    } as never);

    const response = await POST(createRequest());
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('PAYPAL_SANDBOX_NOT_ALLOWED');
    expect(getDecryptedMerchantCredential).not.toHaveBeenCalled();
    expect(captureOrder).not.toHaveBeenCalled();
  });

  it('returns 400 paypal_not_configured when the vault has no credentials', async () => {
    vi.mocked(getDecryptedMerchantCredential).mockRejectedValue(
      new Error('missing')
    );

    const response = await POST(createRequest());
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('PAYPAL_NOT_CONFIGURED');
    expect(captureOrder).not.toHaveBeenCalled();
  });

  it('marks credentials invalid and returns 400 on a PayPal 401', async () => {
    vi.mocked(captureOrder).mockResolvedValue({
      success: false,
      error: 'invalid_client',
      code: 'HTTP_401',
    });

    const response = await POST(createRequest());
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('INVALID_PROVIDER_CREDENTIALS');
    expect(markMerchantCredentialInvalid).toHaveBeenCalledWith(
      MERCHANT_ID,
      'paypal',
      'secret_key',
      'live',
      'invalid_client'
    );
  });

  it('hard-rejects a mode mismatch (sandbox response for a live store)', async () => {
    vi.mocked(detectPayPalResponseMode).mockReturnValue('sandbox');

    const response = await POST(createRequest());
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('PAYPAL_MODE_MISMATCH');
  });

  it('files a reconciliation review when rejecting a captured-but-mismatched payment', async () => {
    // The mismatch is only detectable after PayPal captured funds, so the
    // captured payment must be queued for reconciliation, never dropped.
    vi.mocked(detectPayPalResponseMode).mockReturnValue('sandbox');

    const response = await POST(createRequest());
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('PAYPAL_MODE_MISMATCH');
    expect(filePaypalCapturePersistFailureReview).toHaveBeenCalledWith(
      expect.objectContaining({
        gatewayReference: PAYPAL_ORDER_ID,
        merchantId: MERCHANT_ID,
        orderId: ORDER_ID,
        transactionId: 'txn-1',
        metadata: expect.objectContaining({ stage: 'mode_mismatch' }),
      })
    );
  });

  it('fails closed when PayPal response mode cannot be determined', async () => {
    vi.mocked(captureOrder).mockResolvedValue({
      success: true,
      data: { ...captureData(), links: undefined },
    });
    vi.mocked(detectPayPalResponseMode).mockReturnValue('unknown');

    const response = await POST(createRequest());
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('PAYPAL_MODE_MISMATCH');
  });

  it('rejects when the captured total does not match the presentment', async () => {
    vi.mocked(captureOrder).mockResolvedValue({
      success: true,
      data: captureData([
        {
          id: 'cap-1',
          status: 'COMPLETED',
          amount: { value: '1.00', currency_code: 'USD' },
        },
      ]),
    });

    const response = await POST(createRequest());
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe(
      'Payment amount mismatch with PayPal capture'
    );
  });

  it('files a reconciliation review when capture validation fails after a COMPLETED capture', async () => {
    // Funds are already captured (COMPLETED) but the amount does not reconcile
    // with the stored presentment — the captured money must produce an ops
    // signal, never a bare 400.
    vi.mocked(captureOrder).mockResolvedValue({
      success: true,
      data: captureData([
        {
          id: 'cap-1',
          status: 'COMPLETED',
          amount: { value: '1.00', currency_code: 'USD' },
        },
      ]),
    });

    const response = await POST(createRequest());
    expect(response.status).toBe(400);
    expect(filePaypalCapturePersistFailureReview).toHaveBeenCalledWith(
      expect.objectContaining({
        gatewayReference: PAYPAL_ORDER_ID,
        merchantId: MERCHANT_ID,
        orderId: ORDER_ID,
        transactionId: 'txn-1',
        metadata: expect.objectContaining({
          stage: 'capture_amount_mismatch',
          reason: 'Payment amount mismatch with PayPal capture',
        }),
      })
    );
  });

  it('rejects a partial capture set where one capture is not completed', async () => {
    vi.mocked(captureOrder).mockResolvedValue({
      success: true,
      data: captureData([
        {
          id: 'cap-1',
          status: 'COMPLETED',
          amount: { value: '60.00', currency_code: 'USD' },
        },
        {
          id: 'cap-2',
          status: 'PENDING',
          amount: { value: '40.00', currency_code: 'USD' },
        },
      ]),
    });

    const response = await POST(createRequest());
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe(
      'PayPal capture is not completed'
    );
  });

  it('accepts a multi-capture set that sums to the presentment total', async () => {
    vi.mocked(captureOrder).mockResolvedValue({
      success: true,
      data: captureData([
        {
          id: 'cap-1',
          status: 'COMPLETED',
          amount: { value: '60.00', currency_code: 'USD' },
        },
        {
          id: 'cap-2',
          status: 'COMPLETED',
          amount: { value: '40.00', currency_code: 'USD' },
        },
      ]),
    });

    const response = await POST(createRequest());
    expect(response.status).toBe(200);
    expect((await response.json()).success).toBe(true);
    expect(runPaypalCaptureSideEffects).toHaveBeenCalledWith(
      expect.objectContaining({
        merchantId: MERCHANT_ID,
        paypalOrderId: PAYPAL_ORDER_ID,
        grossAmount: 130000,
      })
    );
  });

  it('files a reconciliation review and returns 500 when the DB write fails after capture', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      buildServiceMock({
        updatedTxn: { data: null, error: { message: 'db down' } },
      }) as never
    );

    const response = await POST(createRequest());
    expect(response.status).toBe(500);
    expect((await response.json()).code).toBe('CAPTURE_PERSIST_FAILED');
    expect(filePaypalCapturePersistFailureReview).toHaveBeenCalledWith(
      expect.objectContaining({
        merchantId: MERCHANT_ID,
        orderId: ORDER_ID,
        transactionId: 'txn-1',
      })
    );
  });

  it('completes the capture and runs side effects on the happy path', async () => {
    const response = await POST(createRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      status: 'success',
      orderNumber: 'BACI-1002',
    });
    expect(runPaypalCaptureSideEffects).toHaveBeenCalledTimes(1);
    // No captured-but-failed condition on the happy path → no ops signal filed.
    expect(filePaypalCapturePersistFailureReview).not.toHaveBeenCalled();
  });

  it('captures with the order original PayPal environment even if the merchant flipped mode mid-checkout', async () => {
    // Order was created LIVE (metadata.paypal_mode='live'); the merchant then
    // flipped feature settings to sandbox. Capture must use the ORIGINAL live
    // environment/vault slot, not the current feature config.
    const base = proceedContext();
    vi.mocked(loadPaypalCaptureContext).mockResolvedValue({
      ...base,
      metadata: { ...META, paypal_mode: 'live' },
      transaction: {
        ...base.transaction,
        metadata: { ...META, paypal_mode: 'live' },
      },
    } as never);
    vi.mocked(createServiceClient).mockReturnValue(
      buildServiceMock({
        custom: { paypal_enabled: true, paypal_mode: 'sandbox' },
      }) as never
    );
    vi.mocked(detectPayPalResponseMode).mockReturnValue('live');

    const response = await POST(createRequest());

    expect(response.status).toBe(200);
    expect(getDecryptedMerchantCredential).toHaveBeenCalledWith(
      MERCHANT_ID,
      'paypal',
      'client_id',
      'live'
    );
    expect(getDecryptedMerchantCredential).toHaveBeenCalledWith(
      MERCHANT_ID,
      'paypal',
      'secret_key',
      'live'
    );
    expect(captureOrder).toHaveBeenCalledWith(
      'mock-client-id',
      'mock-secret-key',
      PAYPAL_ORDER_ID,
      'live',
      expect.stringContaining('capture-')
    );
  });

  it('reconciles a completed-but-unpaid order without re-calling PayPal', async () => {
    // A prior capture flipped the transaction to completed but its order write
    // failed. The retry must reconcile the order to paid and run the side
    // effects — never re-hit PayPal, never return success on an unpaid order.
    const base = proceedContext();
    vi.mocked(loadPaypalCaptureContext).mockResolvedValue({
      ...base,
      reconcileOnly: true,
      transaction: { ...base.transaction, status: 'completed' },
    } as never);

    const response = await POST(createRequest());

    expect(response.status).toBe(200);
    expect((await response.json()).success).toBe(true);
    expect(captureOrder).not.toHaveBeenCalled();
    expect(getDecryptedMerchantCredential).not.toHaveBeenCalled();
    expect(runPaypalCaptureSideEffects).toHaveBeenCalledWith(
      expect.objectContaining({
        merchantId: MERCHANT_ID,
        paypalOrderId: PAYPAL_ORDER_ID,
      })
    );
  });
});
