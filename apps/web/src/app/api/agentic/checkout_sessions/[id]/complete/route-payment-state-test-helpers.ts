import { NextRequest } from 'next/server';
import { vi } from 'vitest';
import { calculateCheckoutSession } from '@/lib/agentic/checkout';
import { createAgenticScopedSupabaseClient } from '@/lib/agentic/scoped-supabase';
import { createServiceClient } from '@/lib/supabase/service';
import { validHumanConfirmation } from './route-complete-test-helpers';

const readySession = {
  id: 'row-1',
  session_id: 'agentic_session_1',
  merchant_id: 'merchant-1',
  cart_items: [{ id: 'product-1', quantity: 1 }],
  shipping_method: 'pickup_store_1',
  shipping_address: { city: 'Lagos' },
  currency: 'NGN',
  status: 'processing',
  order_id: null,
  payment_reference: null,
  virtual_account_bank: null,
  virtual_account_name: null,
  virtual_account_number: null,
  metadata: { agentic: { existing: true } },
};

function buildCompleteRequest({
  confirmationAmount = 500000,
  includeAuthorization = true,
}: {
  confirmationAmount?: number;
  includeAuthorization?: boolean;
} = {}) {
  const body: Record<string, unknown> = {
    payment_data: { provider: 'paystack', token: 'confirmed-by-human' },
    buyer: {
      email: 'buyer@example.com',
      first_name: 'Ada',
      last_name: 'Lovelace',
      phone_number: '+2348012345678',
    },
  };

  if (includeAuthorization) {
    body.completion_authorization = validHumanConfirmation(confirmationAmount);
  }

  return new NextRequest(
    'http://localhost/api/agentic/checkout_sessions/agentic_session_1/complete',
    {
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'idem-1',
      },
      method: 'POST',
    }
  );
}

function mockSession(session: Record<string, unknown>) {
  const updateSpy = vi.fn();
  const readChain = {
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data: session, error: null }),
  };
  readChain.eq.mockReturnValue(readChain);

  const supabase = {
    from: vi.fn((table: string) => {
      if (table === 'checkout_sessions') {
        return {
          select: vi.fn(() => readChain),
          update: updateSpy,
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };

  vi.mocked(createServiceClient).mockReturnValue(supabase as never);
  vi.mocked(createAgenticScopedSupabaseClient).mockReturnValue(
    supabase as never
  );

  return { updateSpy };
}

function getPaymentState(payload: unknown) {
  const metadata =
    payload && typeof payload === 'object' && 'metadata' in payload
      ? (payload as { metadata?: { agentic?: { payment_state?: unknown } } })
          .metadata
      : undefined;
  return metadata?.agentic?.payment_state;
}

function createClaimUpdateChain() {
  const chain = {} as Record<
    'eq' | 'is' | 'not' | 'select',
    ReturnType<typeof vi.fn>
  >;
  const maybeSingle = vi.fn().mockResolvedValue({
    data: readySession,
    error: null,
  });
  chain.eq = vi.fn(() => chain);
  chain.is = vi.fn(() => chain);
  chain.not = vi.fn(() => chain);
  chain.select = vi.fn(() => ({ maybeSingle }));
  return chain;
}

function createFinalUpdateChain() {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: { session_id: 'agentic_session_1' },
    error: null,
  });
  const chain = {} as Record<
    'contains' | 'eq' | 'in' | 'is' | 'select',
    ReturnType<typeof vi.fn>
  >;
  chain.contains = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.in = vi.fn(() => chain);
  chain.is = vi.fn(() => chain);
  chain.select = vi.fn(() => ({ maybeSingle }));
  return chain;
}

function createSessionReadChain() {
  const chain = {} as Record<'eq' | 'maybeSingle', ReturnType<typeof vi.fn>>;
  chain.eq = vi.fn(() => chain);
  chain.maybeSingle = vi.fn().mockResolvedValue({
    data: readySession,
    error: null,
  });
  return chain;
}

function mockSuccessfulPaymentSessionSupabase() {
  const updateSpy = vi.fn((payload: Record<string, unknown>) =>
    getPaymentState(payload) === 'claiming_payment'
      ? createClaimUpdateChain()
      : createFinalUpdateChain()
  );
  const readChain = createSessionReadChain();

  const supabase = {
    from: vi.fn((table: string) => {
      if (table === 'checkout_sessions') {
        return {
          select: vi.fn(() => readChain),
          update: updateSpy,
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };

  vi.mocked(createServiceClient).mockReturnValue(supabase as never);
  vi.mocked(createAgenticScopedSupabaseClient).mockReturnValue(
    supabase as never
  );

  return { readChain, supabase, updateSpy };
}

function mockCalculatedSession({ total = 500000 }: { total?: number } = {}) {
  vi.mocked(calculateCheckoutSession).mockResolvedValue({
    fulfillmentOptions: [],
    lineItems: [
      {
        base_amount: 500000,
        discount: 0,
        id: 'line_product-1',
        item: {
          id: 'product-1',
          product_id: 'product-1',
          quantity: 1,
          title: 'Phone',
        },
        subtotal: 500000,
        tax: 0,
        total,
      },
    ],
    messages: [],
    selectedOptionId: 'pickup_store_1',
    totals: [{ type: 'total', display_text: 'Total Due', amount: total }],
  });
}

export const paymentStateTestHelpers = {
  buildCompleteRequest,
  getPaymentState,
  mockCalculatedSession,
  mockSuccessfulPaymentSessionSupabase,
  mockSession,
  readySession,
};
