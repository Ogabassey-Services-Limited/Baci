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
const lineItems = [
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
];
const totals = [{ amount: 500_000, display_text: 'Total Due', type: 'total' }];

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    cart_items: [{ id: 'product-1', quantity: 1 }],
    currency: 'NGN',
    customer_email: buyer.email,
    customer_name: 'Ada Lovelace',
    customer_phone: buyer.phone_number,
    id: 'row-1',
    merchant_id: 'merchant-1',
    metadata: {
      agentic: {
        buyer,
        dva_account: dvaAccount,
        line_items: lineItems,
        payment_state: 'payment_pending',
        totals,
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
    ...overrides,
  };
}

function makeStoredResponse(overrides: Record<string, unknown> = {}) {
  return {
    buyer,
    currency: 'ngn',
    fulfillment_option_id: 'pickup_store_1',
    id: 'agentic_session_1',
    line_items: lineItems,
    links: [],
    messages: [
      {
        code: 'payment_pending',
        content:
          'Bank transfer account generated. Complete payment to confirm the order.',
        content_type: 'plain',
        type: 'info',
      },
    ],
    order: { id: 'order-1', status: 'payment_pending' },
    order_id: 'order-1',
    payment_details: {
      account_name: dvaAccount.account_name,
      account_number: dvaAccount.account_number,
      bank_name: dvaAccount.bank_name,
      message:
        'Please transfer the exact total to this account to complete your order.',
      type: 'bank_transfer',
    },
    shipping_address: { city: 'Lagos' },
    status: 'ready_for_payment',
    totals,
    ...overrides,
  };
}

export const grandfatheredReplayTestFixtures = {
  makeSession,
  makeStoredResponse,
};
