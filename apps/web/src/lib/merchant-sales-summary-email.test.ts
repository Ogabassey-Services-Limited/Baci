import { describe, expect, it } from 'vitest';
import {
  buildMerchantSalesSummaryEmail,
  summarizeMerchantSalesRows,
} from './merchant-sales-summary-email';

const rows = [
  {
    avg_order_value: 15000,
    order_count: 2,
    paid_orders: 2,
    paid_revenue: 30000,
    pending_orders: 0,
    total_revenue: 30000,
    unique_customers: 2,
  },
  {
    avg_order_value: 5000,
    order_count: 1,
    paid_orders: 0,
    paid_revenue: 0,
    pending_orders: 1,
    total_revenue: 5000,
    unique_customers: 1,
  },
];

describe('merchant sales summary email', () => {
  it('summarizes daily sales rows', () => {
    expect(summarizeMerchantSalesRows(rows)).toEqual({
      avgOrderValue: 11666.67,
      orderCount: 3,
      paidOrders: 2,
      paidRevenue: 30000,
      pendingOrders: 1,
      totalRevenue: 35000,
      uniqueCustomers: 3,
    });
  });

  it('builds a ZeptoMail-ready merchant summary email', () => {
    const email = buildMerchantSalesSummaryEmail({
      businessName: 'Ogabassey',
      currency: 'NGN',
      period: 'daily',
      rows,
    });

    expect(email.subject).toBe('Ogabassey daily sales summary');
    expect(email.textContent).toContain('Orders: 3');
    expect(email.textContent).toContain('Paid revenue: ₦30,000');
    expect(email.htmlContent).toContain('Ogabassey daily sales summary');
  });
});
