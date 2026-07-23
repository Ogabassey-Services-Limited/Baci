import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/email-templates', () => ({
  generateOrderCancellationEmail: vi.fn(() => '<p>cancelled</p>'),
  generateOrderCancellationText: vi.fn(() => 'cancelled'),
}));

import { buildOrderCancellationEmailMessage } from './build-order-cancellation-email-message';

describe('buildOrderCancellationEmailMessage', () => {
  it('builds a merchant cancellation message with audit context', () => {
    const message = buildOrderCancellationEmailMessage({
      cancelledBy: 'merchant',
      merchant: {
        business_name: 'Store',
        cac_rc_number: null,
        email: 'merchant@example.com',
        email_sender_name: null,
        id: 'merchant-1',
        slug: 'store',
        support_email: 'support@example.com',
        tax_identification_number: null,
      },
      order: {
        amount_paid: 5000,
        currency: 'NGN',
        customer_email: 'customer@example.com',
        customer_id: 'customer-1',
        customer_name: 'Ada',
        id: 'order-1',
        order_items: [],
        order_number: 'ORD-1',
        total: 5000,
      },
      reason: 'Requested',
      refundAmount: 5000,
    });

    expect(message).toMatchObject({
      auditContext: { merchantId: 'merchant-1', orderId: 'order-1' },
      subject: 'Order #ORD-1 Has Been Cancelled',
      to: 'customer@example.com',
    });
  });
});
