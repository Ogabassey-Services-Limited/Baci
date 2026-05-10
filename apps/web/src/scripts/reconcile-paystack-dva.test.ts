import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  verifyTransaction: vi.fn(),
  applyPaidOrderSideEffects: vi.fn(),
}));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: mocks.createServiceClient,
}));
vi.mock('@/lib/paystack', () => ({
  verifyTransaction: mocks.verifyTransaction,
}));
vi.mock('@/lib/payments/apply-paid-order-side-effects', () => ({
  applyPaidOrderSideEffects: mocks.applyPaidOrderSideEffects,
}));

import { runReconcilePaystackDvaCli } from '@/scripts/reconcile-paystack-dva';

// Real values pinned in the handoff brief — Efosa Igbinovia 2026-05-09.
const efosaArgs = [
  '--transaction-id',
  '427ec4ea-b41d-4058-aaf9-3de57ee5fa35',
  '--paystack-reference',
  '100026260509110323000058369193',
  '--canonical-order-id',
  '211bcf0e-0795-488f-aeeb-52c5b7a8b9ae',
  '--cancel-orders',
  '9235a8d5-55fc-4e90-8238-4bb6698679bd,de838a51-d0e9-4438-9f55-135b7677783f,a259300d-aef4-44f2-9506-22b47fab756d',
  '--operator-user-id',
  '11111111-1111-1111-1111-111111111111',
];

const verifySuccess = {
  success: true as const,
  data: {
    id: 1,
    status: 'success' as const,
    reference: '100026260509110323000058369193',
    amount: 83_500_000, // ₦835,000 in kobo
    currency: 'NGN',
    channel: 'dedicated_nuban',
    paid_at: '2026-05-09T11:03:00Z',
    created_at: '2026-05-09T11:00:00Z',
    customer: {
      customer_code: 'CUS_X',
      email: 'igbinoviaefosa56@gmail.com',
      first_name: 'Efosa',
      id: 1,
      last_name: 'Igbinovia',
      phone: null,
    },
    metadata: null,
    authorization: null,
    fees: 300_000,
    fees_split: null,
  },
};

function createSupabaseMock(opts: {
  rpcResult?: { data: unknown; error: unknown };
  txn?: Record<string, unknown> | null;
  order?: Record<string, unknown> | null;
  merchant?: Record<string, unknown> | null;
}) {
  const rpcResult = opts.rpcResult ?? {
    data: {
      canonical_order_id: '211bcf0e-0795-488f-aeeb-52c5b7a8b9ae',
      reconciled_at: '2026-05-10T18:00:00Z',
      already_completed: false,
      order_already_paid: false,
      txn_rows_updated: 1,
      order_rows_updated: 1,
      dup_orders_cancelled: 3,
      dup_txns_cancelled: 3,
    },
    error: null,
  };
  const txn = opts.txn ?? {
    id: '427ec4ea-b41d-4058-aaf9-3de57ee5fa35',
    order_id: '211bcf0e-0795-488f-aeeb-52c5b7a8b9ae',
    merchant_id: 'merchant-1',
    gateway_reference: 'BAC-7TUD6N4WJCNM',
    amount: 835_000,
    metadata: {},
  };
  const order = opts.order ?? {
    id: '211bcf0e-0795-488f-aeeb-52c5b7a8b9ae',
    merchant_id: 'merchant-1',
    payment_status: 'paid',
    tax_basis: null, // Efosa's actual prod state
    subtotal: 810_000,
    shipping_fee: 25_000,
    gift_wrapping_fee: 0,
    tax_amount: 60_750,
    discount_amount: 0,
    total: 835_000,
    order_number: 'ORD-260509-00NV-R',
    customer_id: 'customer-1',
    customer_name: 'Efosa Igbinovia',
    customer_email: 'igbinoviaefosa56@gmail.com',
    customer_phone: '+2348000000000',
    currency: 'NGN',
    shipping_address: { address: '1 Lekki', city: 'Lagos', state: 'Lagos' },
    order_items: [],
  };
  const merchant = opts.merchant ?? {
    business_name: 'Ogabassey',
    slug: 'ogabassey',
    support_email: 'support@ogabassey.com',
    email_sender_name: 'Ogabassey',
    email: 'support@ogabassey.com',
    tax_identification_number: null,
    cac_rc_number: null,
  };

  const rpc = vi.fn().mockResolvedValue(rpcResult);
  const from = vi.fn((table: string) => {
    if (table === 'transactions') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: txn, error: null }),
          }),
        }),
      };
    }
    if (table === 'orders') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: order, error: null }),
          }),
        }),
      };
    }
    if (table === 'merchants') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi
              .fn()
              .mockResolvedValue({ data: merchant, error: null }),
          }),
        }),
      };
    }
    throw new Error(`unmocked table: ${table}`);
  });

  return { supabase: { rpc, from }, rpc, from };
}

describe('runReconcilePaystackDvaCli — arg validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exits non-zero when any required flag is missing', async () => {
    const exit = await runReconcilePaystackDvaCli([
      '--transaction-id',
      '427ec4ea-b41d-4058-aaf9-3de57ee5fa35',
      // missing other required flags
    ]);
    expect(exit).toBe(1);
    expect(mocks.verifyTransaction).not.toHaveBeenCalled();
  });

  it('rejects malformed UUIDs with exit code 1', async () => {
    const exit = await runReconcilePaystackDvaCli([
      '--transaction-id',
      'not-a-uuid',
      '--paystack-reference',
      'ref',
      '--canonical-order-id',
      '211bcf0e-0795-488f-aeeb-52c5b7a8b9ae',
      '--cancel-orders',
      '',
      '--operator-user-id',
      '11111111-1111-1111-1111-111111111111',
    ]);
    expect(exit).toBe(1);
    expect(mocks.verifyTransaction).not.toHaveBeenCalled();
  });
});

describe('runReconcilePaystackDvaCli — happy path (Efosa shape)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('verifies, calls the atomic RPC, and runs the outbox helper with the Efosa cancel list', async () => {
    const { supabase } = createSupabaseMock({});
    mocks.createServiceClient.mockReturnValue(supabase);
    mocks.verifyTransaction.mockResolvedValue(verifySuccess);
    mocks.applyPaidOrderSideEffects.mockResolvedValue({
      ranSteps: [
        'paid_email',
        'ad_tracking_conversion',
        'merchant_settlement',
      ],
      skippedSteps: [],
      failedSteps: [
        { step: 'firs_invoice', error: 'financial_totals_inconsistent' },
        { step: 'loyalty_points', error: 'financial_totals_inconsistent' },
      ],
      concurrentTakeoverSteps: [],
    });

    const exit = await runReconcilePaystackDvaCli(efosaArgs);

    expect(exit).toBe(0);
    expect(mocks.verifyTransaction).toHaveBeenCalledWith(
      '100026260509110323000058369193'
    );
    expect(supabase.rpc).toHaveBeenCalledWith(
      'claim_paystack_paid_atomic',
      expect.objectContaining({
        p_transaction_id: '427ec4ea-b41d-4058-aaf9-3de57ee5fa35',
        p_paystack_reference: '100026260509110323000058369193',
        p_canonical_order_id: '211bcf0e-0795-488f-aeeb-52c5b7a8b9ae',
        p_operator_user_id: '11111111-1111-1111-1111-111111111111',
        p_cancel_order_ids: [
          '9235a8d5-55fc-4e90-8238-4bb6698679bd',
          'de838a51-d0e9-4438-9f55-135b7677783f',
          'a259300d-aef4-44f2-9506-22b47fab756d',
        ],
        p_operator_label: 'script:reconcile-paystack-dva',
      })
    );
    // p_gateway_response must be the verified Paystack JSON.
    const rpcCall = supabase.rpc.mock.calls[0]?.[1] as Record<string, unknown>;
    expect((rpcCall.p_gateway_response as Record<string, unknown>).reference).toBe(
      '100026260509110323000058369193'
    );

    // Helper called with the freshly-paid order/transaction shapes
    expect(mocks.applyPaidOrderSideEffects).toHaveBeenCalledWith(
      expect.objectContaining({
        supabase,
        actor: 'script:reconcile-paystack-dva',
        executors: expect.objectContaining({
          paid_email: expect.any(Function),
          ad_tracking_conversion: expect.any(Function),
          merchant_settlement: expect.any(Function),
          firs_invoice: expect.any(Function),
          loyalty_points: expect.any(Function),
        }),
      })
    );
  });
});

describe('runReconcilePaystackDvaCli — Paystack guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exits non-zero and skips the RPC when Paystack verify fails', async () => {
    const { supabase } = createSupabaseMock({});
    mocks.createServiceClient.mockReturnValue(supabase);
    mocks.verifyTransaction.mockResolvedValue({
      success: false,
      error: 'Paystack down',
      code: 'NETWORK_ERROR',
    });

    const exit = await runReconcilePaystackDvaCli(efosaArgs);

    expect(exit).toBe(1);
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(mocks.applyPaidOrderSideEffects).not.toHaveBeenCalled();
  });

  it('exits non-zero when Paystack reports a non-success status', async () => {
    const { supabase } = createSupabaseMock({});
    mocks.createServiceClient.mockReturnValue(supabase);
    mocks.verifyTransaction.mockResolvedValue({
      success: true,
      data: { ...verifySuccess.data, status: 'failed' },
    });

    const exit = await runReconcilePaystackDvaCli(efosaArgs);

    expect(exit).toBe(1);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('exits non-zero when verified amount does not match on-record txn', async () => {
    // On-record txn = ₦835_000; tweak the verify response amount in kobo.
    const { supabase } = createSupabaseMock({});
    mocks.createServiceClient.mockReturnValue(supabase);
    mocks.verifyTransaction.mockResolvedValue({
      success: true,
      data: { ...verifySuccess.data, amount: 100 }, // ₦1
    });

    const exit = await runReconcilePaystackDvaCli(efosaArgs);

    expect(exit).toBe(1);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});

describe('runReconcilePaystackDvaCli — RPC failure modes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exits non-zero and skips the outbox when the atomic RPC errors', async () => {
    const { supabase } = createSupabaseMock({
      rpcResult: {
        data: null,
        error: {
          message:
            'transaction_order_link_mismatch: txn X is for order Y, got Z',
        },
      },
    });
    mocks.createServiceClient.mockReturnValue(supabase);
    mocks.verifyTransaction.mockResolvedValue(verifySuccess);

    const exit = await runReconcilePaystackDvaCli(efosaArgs);

    expect(exit).toBe(1);
    expect(mocks.applyPaidOrderSideEffects).not.toHaveBeenCalled();
  });

  it('idempotent replay: returns exit 0 when already_completed=true', async () => {
    const { supabase } = createSupabaseMock({
      rpcResult: {
        data: {
          canonical_order_id: '211bcf0e-0795-488f-aeeb-52c5b7a8b9ae',
          reconciled_at: '2026-05-10T18:30:00Z',
          already_completed: true,
          order_already_paid: true,
          txn_rows_updated: 0,
          order_rows_updated: 0,
          dup_orders_cancelled: 0,
          dup_txns_cancelled: 0,
        },
        error: null,
      },
    });
    mocks.createServiceClient.mockReturnValue(supabase);
    mocks.verifyTransaction.mockResolvedValue(verifySuccess);
    mocks.applyPaidOrderSideEffects.mockResolvedValue({
      ranSteps: [],
      skippedSteps: [
        'paid_email',
        'ad_tracking_conversion',
        'merchant_settlement',
      ],
      failedSteps: [],
      concurrentTakeoverSteps: [],
    });

    const exit = await runReconcilePaystackDvaCli(efosaArgs);

    expect(exit).toBe(0);
    expect(mocks.applyPaidOrderSideEffects).toHaveBeenCalledTimes(1);
  });
});

describe('runReconcilePaystackDvaCli — outbox failure surfaces in exit code', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns non-zero when a non-Δ-31 step fails (paid_email, settlement, ad_tracking)', async () => {
    const { supabase } = createSupabaseMock({});
    mocks.createServiceClient.mockReturnValue(supabase);
    mocks.verifyTransaction.mockResolvedValue(verifySuccess);
    mocks.applyPaidOrderSideEffects.mockResolvedValue({
      ranSteps: ['paid_email'],
      skippedSteps: [],
      failedSteps: [{ step: 'merchant_settlement', error: 'rpc_timeout' }],
      concurrentTakeoverSteps: [],
    });

    const exit = await runReconcilePaystackDvaCli(efosaArgs);
    expect(exit).toBe(1);
  });

  it('returns 0 when only Δ-31 firs/loyalty failures remain (expected for Efosa)', async () => {
    const { supabase } = createSupabaseMock({});
    mocks.createServiceClient.mockReturnValue(supabase);
    mocks.verifyTransaction.mockResolvedValue(verifySuccess);
    mocks.applyPaidOrderSideEffects.mockResolvedValue({
      ranSteps: [
        'paid_email',
        'ad_tracking_conversion',
        'merchant_settlement',
      ],
      skippedSteps: [],
      failedSteps: [
        { step: 'firs_invoice', error: 'financial_totals_inconsistent' },
        { step: 'loyalty_points', error: 'financial_totals_inconsistent' },
      ],
      concurrentTakeoverSteps: [],
    });

    const exit = await runReconcilePaystackDvaCli(efosaArgs);
    expect(exit).toBe(0);
  });
});
