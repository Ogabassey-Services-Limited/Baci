import { describe, expect, it } from 'vitest';
import { resolveGrandfatheredPaymentPendingReplay } from '@/lib/agentic/agentic-paystack-dva-grandfathered-response';
import { buildPaymentPendingCheckoutResponse } from '@/lib/agentic/checkout-completion-response';

const buyer = {
  email: 'buyer@example.com',
  first_name: 'Ada',
  last_name: 'Lovelace',
  phone_number: '+2348012345678',
};
const dvaAccount = {
  account_name: 'Baci Test',
  account_number: '1234567890',
  bank_name: 'Paystack-Titan',
};
const sessionCalc = {
  lineItems: [
    {
      base_amount: 500_000,
      discount: 0,
      id: 'line_product-1',
      item: {
        id: 'product-1',
        product_id: 'product-1',
        quantity: 1,
        title: 'Phone',
      },
      subtotal: 500_000,
      tax: 0,
      total: 500_000,
    },
  ],
  totals: [
    { amount: 500_000, display_text: 'Total Due', type: 'total' as const },
  ],
};

function makeSession() {
  return {
    currency: 'NGN',
    customer_email: buyer.email,
    customer_name: 'Ada Lovelace',
    customer_phone: buyer.phone_number,
    metadata: {
      agentic: {
        buyer,
        dva_account: dvaAccount,
        line_items: sessionCalc.lineItems,
        payment_state: 'payment_pending',
        totals: sessionCalc.totals,
      },
    },
    order_id: 'order-1',
    payment_method: 'bank_transfer',
    payment_provider: 'paystack',
    payment_reference: dvaAccount.account_number,
    session_id: 'agentic_session_1',
    shipping_address: { city: 'Lagos' },
    shipping_method: 'pickup_store_1',
    status: 'processing',
    virtual_account_bank: dvaAccount.bank_name,
    virtual_account_name: dvaAccount.account_name,
    virtual_account_number: dvaAccount.account_number,
  };
}

function makeStoredResponse() {
  return buildPaymentPendingCheckoutResponse({
    buyer,
    dvaAccount,
    orderId: 'order-1',
    session: makeSession(),
    sessionCalc,
  });
}

function resolve({
  requestHash = 'a'.repeat(64),
  response = makeStoredResponse(),
  session = makeSession(),
  status = 200,
}: {
  requestHash?: string;
  response?: unknown;
  session?: ReturnType<typeof makeSession>;
  status?: number;
} = {}) {
  return resolveGrandfatheredPaymentPendingReplay({
    replay: { requestHash, response, status },
    session,
  });
}

describe('grandfathered Agentic Paystack DVA response', () => {
  it('returns the exact stored response for a fully matching immutable replay', () => {
    const response = makeStoredResponse();

    expect(resolve({ response })).toEqual({ body: response, status: 200 });
  });

  it.each([
    ['buyer', { buyer: { ...buyer, email: 'changed@example.com' } }],
    ['amount', { totals: [{ ...sessionCalc.totals[0], amount: 400_000 }] }],
    [
      'account',
      {
        payment_details: {
          ...makeStoredResponse().payment_details,
          account_number: '9999999999',
        },
      },
    ],
    ['order', { order_id: 'order-changed' }],
    ['terms', { fulfillment_option_id: 'delivery_changed' }],
  ])('rejects a stored response with changed %s', (_label, change) => {
    expect(resolve({ response: { ...makeStoredResponse(), ...change } })).toBe(
      null
    );
  });

  it('rejects disagreement between metadata and checkout-session account identity', () => {
    expect(
      resolve({
        session: {
          ...makeSession(),
          virtual_account_number: '9999999999',
        },
      })
    ).toBe(null);
  });

  it.each([
    ['order id', { order_id: null }],
    ['payment provider', { payment_provider: 'other' }],
    ['payment method', { payment_method: 'card' }],
    ['currency', { currency: 'USD' }],
    ['malformed currency', { currency: null }],
    ['session state', { status: 'completed' }],
    ['customer email', { customer_email: 'changed@example.com' }],
  ])('rejects a session with changed or missing %s', (_label, change) => {
    expect(
      resolve({
        session: { ...makeSession(), ...change } as ReturnType<
          typeof makeSession
        >,
      })
    ).toBe(null);
  });

  it.each([
    ['missing buyer snapshot', { buyer: undefined }],
    ['missing line-item snapshot', { line_items: undefined }],
    ['missing totals snapshot', { totals: undefined }],
    ['wrong payment state', { payment_state: 'payment_account_ready' }],
  ])('rejects %s', (_label, metadataChange) => {
    const session = makeSession();
    session.metadata.agentic = {
      ...session.metadata.agentic,
      ...metadataChange,
    } as typeof session.metadata.agentic;

    expect(resolve({ session })).toBe(null);
  });

  it.each([
    ['invalid request hash', { requestHash: 'not-a-sha256' }],
    ['non-success response', { status: 409 }],
  ])('rejects a replay with %s', (_label, replayChange) => {
    expect(resolve(replayChange)).toBe(null);
  });
});
