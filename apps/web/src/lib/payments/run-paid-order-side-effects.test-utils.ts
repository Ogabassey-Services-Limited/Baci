import { vi } from 'vitest';

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object') {
    return value;
  }
  for (const property of Object.getOwnPropertyNames(value)) {
    deepFreeze((value as Record<string, unknown>)[property]);
  }
  return Object.freeze(value) as T;
}

export const richOrder = deepFreeze({
  ad_tracking: { fbclid: 'fb-1' },
  currency: 'NGN',
  customer_email: 'jane@example.com',
  customer_id: 'customer-1',
  customer_name: 'Jane Doe',
  customer_phone: '+2348012345678',
  discount_amount: 0,
  gift_wrapping_fee: 0,
  id: 'order-1',
  merchant_id: 'merchant-1',
  order_items: [
    { name: 'iPhone', price: 20_000, quantity: 1, variant_name: null },
  ],
  order_number: 'BAC-1',
  payment_status: 'paid' as const,
  shipping_address: { address: '1 Baci Way', city: 'Lagos', state: 'LA' },
  shipping_fee: 0,
  subtotal: 20_000,
  tax_amount: 0,
  tax_basis: 'exclusive' as const,
  total: 20_000,
});

export const transaction = deepFreeze({
  amount: 20_000,
  gateway_reference: 'WALLET-DVA-ORDER-order-1',
  id: 'txn-order-1',
  merchant_id: 'merchant-1',
  order_id: 'order-1',
  platform_fee: 200,
});

export function createPaidOrderSideEffectsSupabase({
  merchantData = {
    business_name: 'Ogabassey',
    cac_rc_number: 'RC123',
    email: 'merchant@example.com',
    email_sender_name: 'Ogabassey',
    slug: 'ogabassey',
    support_email: 'support@example.com',
    tax_identification_number: 'TIN123',
  },
  merchantError = null,
}: {
  merchantData?: Record<string, unknown> | null;
  merchantError?: { code?: string; message?: string } | null;
} = {}) {
  const single = vi.fn(async () => ({
    data: merchantData,
    error: merchantError,
  }));
  const eq = vi.fn(() => ({ single }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  const rpc = vi.fn(async () => ({ data: null, error: null }));

  return {
    eq,
    from,
    rpc,
    select,
    single,
  };
}
