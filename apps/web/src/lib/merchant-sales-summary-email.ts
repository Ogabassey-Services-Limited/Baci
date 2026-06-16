export type MerchantSalesSummaryPeriod = 'daily' | 'weekly';

export interface MerchantSalesSummaryRow {
  avg_order_value: number | null;
  order_count: number | null;
  paid_orders: number | null;
  paid_revenue: number | null;
  pending_orders: number | null;
  total_revenue: number | null;
  unique_customers: number | null;
}

export interface MerchantSalesSummaryTotals {
  avgOrderValue: number;
  orderCount: number;
  paidOrders: number;
  paidRevenue: number;
  pendingOrders: number;
  totalRevenue: number;
  uniqueCustomers: number;
}

function toNumber(value: number | null | undefined): number {
  return Number.isFinite(value) ? Number(value) : 0;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

const _currencyFormatterCache = new Map<string, Intl.NumberFormat>();

function getCurrencyFormatter(currency: string): Intl.NumberFormat {
  let formatter = _currencyFormatterCache.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-NG', {
      currency,
      maximumFractionDigits: 0,
      style: 'currency',
    });
    _currencyFormatterCache.set(currency, formatter);
  }
  return formatter;
}

function formatCurrency(value: number, currency: string): string {
  return getCurrencyFormatter(currency).format(value);
}

export function summarizeMerchantSalesRows(
  rows: MerchantSalesSummaryRow[]
): MerchantSalesSummaryTotals {
  const totals = rows.reduce(
    (summary, row) => ({
      orderCount: summary.orderCount + toNumber(row.order_count),
      paidOrders: summary.paidOrders + toNumber(row.paid_orders),
      paidRevenue: summary.paidRevenue + toNumber(row.paid_revenue),
      pendingOrders: summary.pendingOrders + toNumber(row.pending_orders),
      totalRevenue: summary.totalRevenue + toNumber(row.total_revenue),
      uniqueCustomers: summary.uniqueCustomers + toNumber(row.unique_customers),
    }),
    {
      orderCount: 0,
      paidOrders: 0,
      paidRevenue: 0,
      pendingOrders: 0,
      totalRevenue: 0,
      uniqueCustomers: 0,
    }
  );

  return {
    ...totals,
    avgOrderValue:
      totals.orderCount > 0
        ? roundMoney(totals.totalRevenue / totals.orderCount)
        : 0,
  };
}

export function buildMerchantSalesSummaryEmail({
  businessName,
  currency,
  period,
  rows,
}: {
  businessName: string;
  currency: string;
  period: MerchantSalesSummaryPeriod;
  rows: MerchantSalesSummaryRow[];
}) {
  const totals = summarizeMerchantSalesRows(rows);
  const subject = `${businessName} ${period} sales summary`;
  const revenue = formatCurrency(totals.totalRevenue, currency);
  const paidRevenue = formatCurrency(totals.paidRevenue, currency);
  const avgOrderValue = formatCurrency(totals.avgOrderValue, currency);
  const textContent = [
    subject,
    '',
    `Orders: ${totals.orderCount}`,
    `Paid orders: ${totals.paidOrders}`,
    `Pending orders: ${totals.pendingOrders}`,
    `Total revenue: ${revenue}`,
    `Paid revenue: ${paidRevenue}`,
    `Average order value: ${avgOrderValue}`,
    `Unique customers: ${totals.uniqueCustomers}`,
  ].join('\n');

  const htmlContent = `
    <!doctype html>
    <html>
      <body style="font-family: Arial, sans-serif; color: #111827;">
        <h1>${subject}</h1>
        <p>Here is your ${period} store performance summary.</p>
        <ul>
          <li><strong>Orders:</strong> ${totals.orderCount}</li>
          <li><strong>Paid orders:</strong> ${totals.paidOrders}</li>
          <li><strong>Pending orders:</strong> ${totals.pendingOrders}</li>
          <li><strong>Total revenue:</strong> ${revenue}</li>
          <li><strong>Paid revenue:</strong> ${paidRevenue}</li>
          <li><strong>Average order value:</strong> ${avgOrderValue}</li>
          <li><strong>Unique customers:</strong> ${totals.uniqueCustomers}</li>
        </ul>
      </body>
    </html>
  `;

  return { htmlContent, subject, textContent, totals };
}
