import { describe, expect, it } from 'vitest';
import { formatMerchantAmount } from '@/lib/format-merchant-currency';
import { buildOrderReportHtml } from './buildOrderReportHtml';
import { buildOrderReportSummary } from './buildOrderReportSummary';
import { makeOrder } from './order-export.test-helpers';

const REPORT_AMOUNT_OPTIONS = {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
};

function ngn(amount: number): string {
  return formatMerchantAmount(
    amount,
    { payout_currency: 'NGN' },
    REPORT_AMOUNT_OPTIONS
  );
}

function inr(amount: number): string {
  return formatMerchantAmount(
    amount,
    { payout_currency: 'INR' },
    REPORT_AMOUNT_OPTIONS
  );
}

describe('buildOrderReportHtml', () => {
  it('renders the report shell, store branding, and summary values', () => {
    const orders = [
      makeOrder({
        customer_name: 'Grace Hopper',
        id: 'order_abc12345',
        total: 22000,
      }),
    ];
    const summary = buildOrderReportSummary(orders, []);

    const html = buildOrderReportHtml({
      dateRangeLabel: 'May 1 - May 10, 2026',
      generatedAt: new Date('2026-05-10T12:00:00.000Z'),
      logoUrl: 'https://cdn.example.com/logo.png',
      orders,
      storeName: 'Baci HQ',
      summary,
    });

    expect(html).toContain('Sales Report');
    expect(html).toContain('Baci HQ');
    expect(html).toContain('May 1 - May 10, 2026');
    expect(html).toContain('https://cdn.example.com/logo.png');
    expect(html).toContain(ngn(22000));
    expect(html).not.toContain('NaN');
    expect(html).toContain('Grace Hopper');
    expect(html).toContain('#ORDER_AB');
  });

  it('omits the top performer section when there is no top product', () => {
    const orders = [makeOrder()];
    const summary = buildOrderReportSummary(orders, []);

    const html = buildOrderReportHtml({
      dateRangeLabel: 'Today',
      generatedAt: new Date('2026-05-10T12:00:00.000Z'),
      orders,
      storeName: 'No Logo Store',
      summary,
    });

    expect(html).not.toContain('Best Selling Product');
    expect(html).toContain('No Logo Store');
  });

  it('formats every amount using the order currency instead of a hardcoded NGN default', () => {
    const orders = [
      makeOrder({
        currency: 'INR',
        customer_name: 'Ada Sharma',
        discount_amount: 200,
        id: 'order_inr00001',
        shipping_fee: 300,
        subtotal: 9000,
        tax_amount: 500,
        total: 9600,
      }),
    ];
    const summary = buildOrderReportSummary(orders, []);

    const html = buildOrderReportHtml({
      dateRangeLabel: 'May 1 - May 10, 2026',
      generatedAt: new Date('2026-05-10T12:00:00.000Z'),
      orders,
      storeName: 'Mumbai Threads',
      summary,
    });

    // Total revenue, subtotal, shipping, tax, discounts, and the per-order
    // transaction row all render in the merchant's own currency (INR), not NGN.
    expect(html).toContain(inr(9600));
    expect(html).toContain(inr(9000));
    expect(html).toContain(inr(300));
    expect(html).toContain(inr(500));
    expect(html).toContain(inr(200));
    expect(html).not.toContain(ngn(9600));
    expect(html).not.toContain('₦');
  });

  it('falls back to NGN when the report has no orders', () => {
    const summary = buildOrderReportSummary([], []);

    const html = buildOrderReportHtml({
      dateRangeLabel: 'Today',
      generatedAt: new Date('2026-05-10T12:00:00.000Z'),
      orders: [],
      storeName: 'Empty Store',
      summary,
    });

    expect(html).toContain(ngn(0));
  });
});
