import { describe, expect, it } from 'vitest';
import {
  getPaystackCustomerName,
  getPaystackDvaOrderCurrency,
  normalizePaystackDvaOrderCandidate,
  toPaystackKobo,
} from '@/lib/payments/paystack-dva-order-candidate';

const row = {
  assigned_at: '2026-05-09T10:00:00Z',
  created_at: '2026-05-09T10:00:00Z',
  expires_at: '2026-05-09T11:30:00Z',
  order_id: 'order-1',
  payable_amount: '350000',
  orders: {
    currency: 'NGN',
    customer_email: 'customer@example.com',
    merchant_id: 'merchant-1',
    payment_status: 'unpaid',
    shipping_status: 'pending',
    total: '835000',
  },
};

describe('paystack DVA order candidate', () => {
  it('normalizes an active unpaid invoice using its payable amount', () => {
    expect(normalizePaystackDvaOrderCandidate(row)).toMatchObject({
      customer_email: 'customer@example.com',
      merchant_id: 'merchant-1',
      order_id: 'order-1',
      payable_amount_kobo: 35_000_000,
      total_kobo: 83_500_000,
    });
  });

  it('rejects terminal payment and shipping states', () => {
    expect(
      normalizePaystackDvaOrderCandidate({
        ...row,
        orders: { ...row.orders, payment_status: 'paid' },
      })
    ).toBeNull();
    expect(
      normalizePaystackDvaOrderCandidate({
        ...row,
        orders: { ...row.orders, shipping_status: 'canceled' },
      })
    ).toBeNull();
  });

  it('returns the winner currency and converts NGN to kobo', () => {
    expect(getPaystackDvaOrderCurrency([row], 'order-1')).toBe('NGN');
    expect(toPaystackKobo(835_000)).toBe(83_500_000);
    expect(
      getPaystackCustomerName({ first_name: ' Tony ', last_name: 'Clarke' })
    ).toBe('Tony Clarke');
  });
});
