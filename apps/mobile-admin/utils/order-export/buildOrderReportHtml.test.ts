import { describe, expect, it, vi } from 'vitest';
import { makeOrder } from './order-export.test-helpers';
import { buildOrderReportHtml } from './buildOrderReportHtml';
import { buildOrderReportSummary } from './buildOrderReportSummary';

vi.mock('@/utils/format', () => ({
  formatCurrency: (amount: number) => `NGN ${amount}`,
}));

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
    expect(html).toContain('NGN 22000');
    expect(html).not.toContain('NGN NaN');
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
});
