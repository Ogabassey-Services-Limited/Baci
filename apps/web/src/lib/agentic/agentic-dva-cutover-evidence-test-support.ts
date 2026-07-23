function claimingRow(overrides: Record<string, unknown> = {}) {
  return {
    cart_items: [],
    currency: 'NGN',
    customer_email: null,
    customer_name: null,
    customer_phone: null,
    merchant_id: 'merchant-1',
    metadata: { agentic: { payment_state: 'claiming_payment' } },
    order_id: null,
    payment_method: null,
    payment_provider: null,
    payment_reference:
      'agentic_claim_agentic_session_1_123e4567-e89b-12d3-a456-426614174000',
    session_id: 'agentic_session_1',
    shipping_address: { city: 'Lagos' },
    shipping_method: 'pickup_store_1',
    status: 'processing',
    shipping_cost: 0,
    subtotal: 500000,
    total_amount: 500000,
    updated_at: '2026-07-20T11:30:00.000Z',
    virtual_account_bank: null,
    virtual_account_name: null,
    virtual_account_number: null,
    ...overrides,
  };
}

function accountReadyRow(overrides: Record<string, unknown> = {}) {
  return {
    ...claimingRow(),
    cart_items: [{ id: 'item-1', quantity: 1 }],
    customer_email: 'buyer@example.com',
    customer_name: 'Ada Lovelace',
    customer_phone: '+2348012345678',
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
    ...overrides,
  };
}

export const agenticDvaCutoverEvidenceTestSupport = {
  accountReadyRow,
  claimingRow,
} as const;
