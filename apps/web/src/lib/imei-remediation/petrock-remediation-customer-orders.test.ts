import { describe, expect, it, vi } from 'vitest';
import { readCustomerPetrockRemediationOrders } from './petrock-remediation-customer-orders';

describe('readCustomerPetrockRemediationOrders', () => {
  it('reads only the customer-safe view and maps public fields', async () => {
    const builder = {
      eq: vi.fn(() => builder),
      order: vi.fn().mockResolvedValue({
        data: [
          {
            amount_ngn: '100000',
            amount_usdt: null,
            carrier: 'AT&T',
            completed_at: null,
            created_at: '2026-07-11T12:00:00.000Z',
            customer_message: 'Processing',
            device_model: 'iPhone 17 Pro Max',
            id: 'order-1',
            paid_at: '2026-07-11T12:01:00.000Z',
            payment_currency: 'NGN',
            refund_policy: 'refundable',
            refunded_at: null,
            status: 'in_progress',
            status_segment: 'clean',
            submitted_at: '2026-07-11T12:02:00.000Z',
            success_rate: '82',
            turnaround: '1-7 Days',
            updated_at: '2026-07-11T12:03:00.000Z',
          },
        ],
        error: null,
      }),
      select: vi.fn(() => builder),
    };
    const supabase = { from: vi.fn(() => builder) };

    await expect(
      readCustomerPetrockRemediationOrders({
        customerId: 'customer-1',
        merchantId: 'merchant-1',
        supabase: supabase as never,
      })
    ).resolves.toMatchObject([
      {
        amountNgn: 100000,
        carrier: 'AT&T',
        deviceModel: 'iPhone 17 Pro Max',
        status: 'in_progress',
        successRate: 82,
      },
    ]);
    expect(supabase.from).toHaveBeenCalledWith('petrock_order_customer_status');
    expect(builder.eq).toHaveBeenCalledWith('customer_id', 'customer-1');
    expect(builder.eq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
  });
});
