// Shared fixtures for `order-wallet-funding-intent.test.ts`. Kept in a
// non-`.test` module so the assertion file stays under the 300-line limit.

export const VALID_ORDER_ID = '00000000-0000-4000-8000-000000000101';
export const VALID_MERCHANT_ID = '00000000-0000-4000-8000-000000000102';

export const INTENT = {
  currency: 'ngn',
  expectedAmount: 5000,
  expiresAt: '2026-07-13T10:30:00.000Z',
  fundedAmount: 0,
  id: VALID_ORDER_ID,
  orderId: VALID_MERCHANT_ID,
  status: 'pending',
  targetOrderAmount: 5000,
};
