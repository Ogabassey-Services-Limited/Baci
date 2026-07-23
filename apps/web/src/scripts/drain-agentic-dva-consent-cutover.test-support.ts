import { vi } from 'vitest';
import { assessAgenticDvaCutoverSession } from '@/lib/agentic/agentic-dva-cutover-evidence';

const now = new Date('2026-07-20T12:00:00.000Z');

function claimingRow() {
  return {
    cart_items: [],
    currency: 'NGN',
    customer_email: null,
    customer_name: null,
    customer_phone: null,
    merchant_id: 'merchant-1',
    metadata: {
      agentic: {
        canary: 'secret-canary',
        payment_state: 'claiming_payment',
      },
    },
    order_id: null,
    payment_method: null,
    payment_provider: null,
    payment_reference:
      'agentic_claim_agentic_session_1_123e4567-e89b-12d3-a456-426614174000',
    session_id: 'agentic_session_1',
    shipping_address: { city: 'Lagos' },
    shipping_cost: 0,
    shipping_method: 'pickup_store_1',
    status: 'processing',
    subtotal: 500000,
    total_amount: 500000,
    updated_at: '2026-07-20T11:30:00.000Z',
    virtual_account_bank: null,
    virtual_account_name: null,
    virtual_account_number: null,
  };
}

function accountReadyRow() {
  return {
    ...claimingRow(),
    cart_items: [{ id: 'item-1', quantity: 1 }],
    metadata: {
      agentic: {
        buyer: {
          email: 'buyer@example.com',
          first_name: 'Ada',
          last_name: 'Lovelace',
          phone_number: '+2348012345678',
        },
        dva_account: {
          account_name: 'Ada Lovelace',
          account_number: '1234567890',
          bank_name: 'Paystack-Titan',
        },
        line_items: [
          {
            base_amount: 500000,
            discount: 0,
            id: 'line-1',
            item: { id: 'item-1', product_id: 'product-1', quantity: 1 },
            subtotal: 500000,
            tax: 0,
            total: 500000,
          },
        ],
        payment_state: 'payment_account_ready',
        totals: [
          { amount: 500000, display_text: 'Subtotal', type: 'subtotal' },
          { amount: 0, display_text: 'Shipping', type: 'fulfillment' },
          { amount: 500000, display_text: 'Total', type: 'total' },
        ],
      },
    },
    payment_method: 'bank_transfer',
    payment_provider: 'paystack',
    payment_reference: '1234567890',
    virtual_account_bank: 'Paystack-Titan',
    virtual_account_name: 'Ada Lovelace',
    virtual_account_number: '1234567890',
  };
}

function argsFor(row: ReturnType<typeof claimingRow>, state: string) {
  const fingerprint = assessAgenticDvaCutoverSession(row, now)
    .evidenceFingerprint;
  return [
    '--session-id',
    row.session_id,
    '--expected-state',
    state,
    '--evidence-fingerprint',
    fingerprint,
  ];
}

function createSupabase(
  row: unknown,
  updateResult = { data: null, error: null },
  readResult: { data: unknown; error: unknown } = { data: row, error: null }
) {
  const readChain = { eq: vi.fn(), maybeSingle: vi.fn(), select: vi.fn() };
  readChain.eq.mockReturnValue(readChain);
  readChain.select.mockReturnValue(readChain);
  readChain.maybeSingle.mockResolvedValue(readResult);
  const updateChain = {
    contains: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    select: vi.fn(),
  };
  updateChain.contains.mockReturnValue(updateChain);
  updateChain.eq.mockReturnValue(updateChain);
  updateChain.is.mockReturnValue(updateChain);
  updateChain.select.mockReturnValue({
    maybeSingle: vi.fn().mockResolvedValue(updateResult),
  });
  const update = vi.fn(() => updateChain);
  return {
    supabase: { from: vi.fn(() => ({ select: readChain.select, update })) },
    update,
    updateChain,
  };
}

export const drainAgenticDvaTestSupport = {
  accountReadyRow,
  argsFor,
  claimingRow,
  createSupabase,
  now,
} as const;
