import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getOrder } from '@/lib/paypal';
import { validatePaypalCaptureSet } from './paypal-capture-validation';
import { reconcileCompletedPaypalOrderForCreate } from './paypal-completed-order-reconcile';
import { reconcilePaypalOrderToPaid } from './reconcile-paypal-order';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/lib/paypal', () => ({ getOrder: vi.fn() }));

vi.mock('./paypal-capture-validation', () => ({
  validatePaypalCaptureSet: vi.fn(),
}));

vi.mock('./reconcile-paypal-order', () => ({
  reconcilePaypalOrderToPaid: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./file-paypal-capture-persist-failure-review', () => ({
  filePaypalCapturePersistFailureReview: vi.fn().mockResolvedValue(undefined),
}));

function buildSupabase(txn: Record<string, unknown> | null) {
  const flip = vi.fn(() => builder);
  const builder: Record<string, unknown> = {
    select: () => builder,
    update: () => flip(),
    eq: () => builder,
    maybeSingle: () => Promise.resolve({ data: txn, error: null }),
    // biome-ignore lint/suspicious/noThenProperty: intentional thenable query-builder mock
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ error: null }).then(resolve),
  };
  const client = { from: () => builder };
  return { client: client as unknown as SupabaseClient, flip };
}

const BASE = {
  merchantId: 'm1',
  orderId: 'o1',
  paypalOrderId: 'PP-1',
  orderTotal: 130000,
  preCaptureStatus: {
    payment_status: 'unpaid',
    shipping_status: 'pending',
    amount_paid: 0,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(validatePaypalCaptureSet).mockReturnValue({
    ok: true,
    capturedTotal: 100,
    currency: 'USD',
  });
});

describe('reconcileCompletedPaypalOrderForCreate (F-393)', () => {
  it('no transaction row → does nothing', async () => {
    const { client } = buildSupabase(null);
    await reconcileCompletedPaypalOrderForCreate(client, BASE);
    expect(reconcilePaypalOrderToPaid).not.toHaveBeenCalled();
  });

  it('already-completed txn → reconciles directly without re-fetching PayPal', async () => {
    const { client } = buildSupabase({
      id: 'txn-1',
      amount: 100000,
      status: 'completed',
      metadata: {},
    });
    await reconcileCompletedPaypalOrderForCreate(client, BASE);
    expect(getOrder).not.toHaveBeenCalled();
    expect(reconcilePaypalOrderToPaid).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionId: 'txn-1',
        lockedResidual: 100000,
        prepaidTender: 30000,
      })
    );
  });

  it('pending txn (reuse branch) + PayPal COMPLETED → validates, flips txn, reconciles (no 2nd charge)', async () => {
    vi.mocked(getOrder).mockResolvedValue({
      success: true,
      data: {
        id: 'PP-1',
        status: 'COMPLETED',
        purchase_units: [{ payments: { captures: [] } }],
      },
    } as never);
    const { client, flip } = buildSupabase({
      id: 'txn-1',
      amount: 100000,
      status: 'pending',
      metadata: {
        paypal_presentment_amount: 100,
        paypal_presentment_currency: 'USD',
      },
    });

    await reconcileCompletedPaypalOrderForCreate(client, {
      ...BASE,
      credentials: { clientId: 'c', secretKey: 's' },
      mode: 'live',
    });

    expect(flip).toHaveBeenCalled();
    expect(reconcilePaypalOrderToPaid).toHaveBeenCalledTimes(1);
  });

  it('pending txn but no credentials → cannot reconcile, does nothing', async () => {
    const { client } = buildSupabase({
      id: 'txn-1',
      amount: 100000,
      status: 'pending',
      metadata: {},
    });
    await reconcileCompletedPaypalOrderForCreate(client, BASE);
    expect(getOrder).not.toHaveBeenCalled();
    expect(reconcilePaypalOrderToPaid).not.toHaveBeenCalled();
  });

  it('pending txn + PayPal not COMPLETED → nothing captured, does nothing', async () => {
    vi.mocked(getOrder).mockResolvedValue({
      success: true,
      data: { id: 'PP-1', status: 'APPROVED' },
    } as never);
    const { client } = buildSupabase({
      id: 'txn-1',
      amount: 100000,
      status: 'pending',
      metadata: {},
    });
    await reconcileCompletedPaypalOrderForCreate(client, {
      ...BASE,
      credentials: { clientId: 'c', secretKey: 's' },
      mode: 'live',
    });
    expect(reconcilePaypalOrderToPaid).not.toHaveBeenCalled();
  });
});
