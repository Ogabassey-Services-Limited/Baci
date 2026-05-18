import { escapeHtml } from '@baci/shared';
import { format } from 'date-fns';
import { formatCurrency } from '@/utils/format';
import { orderReportStyles } from './orderReportStyles';
import type { OrderReportHtmlInput } from './orderReportTypes';

function renderBreakdown(
  entries: OrderReportHtmlInput['summary']['salesByOrigin']
): string {
  return entries
    .map(([name, data]) => {
      return `
        <div class="list-item">
          <div class="item-info">
            <span class="item-name">${escapeHtml(name)}</span>
            <span class="item-count">${data.count} orders</span>
          </div>
          <div class="item-val">${formatCurrency(data.total)}</div>
        </div>
      `;
    })
    .join('');
}

function renderTopProduct(input: OrderReportHtmlInput): string {
  const { summary } = input;

  if (!summary.topProduct) {
    return '';
  }

  return `
    <div class="section-label">Top Performer</div>
    <div class="insights-grid">
      <div class="insight-card">
        <div class="insight-header">
          <div class="insight-title">🔥 Best Selling Product</div>
          <span class="insight-badge badge-success">Top Seller</span>
        </div>
        <div class="insight-content">
          <div>
            <div class="insight-main">${escapeHtml(summary.topProduct.name)}</div>
            <div class="insight-sub">${summary.topProduct.qty} units sold this period</div>
          </div>
          <div class="insight-stat">
            <div class="insight-stat-label">Revenue</div>
            <div class="insight-stat-value">${formatCurrency(summary.topProduct.revenue)}</div>
          </div>
        </div>
      </div>
      <div class="insight-card">
        <div class="insight-header">
          <div class="insight-title">📈 Quick Stats</div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 12px;">
          <div>
            <div class="insight-stat-label">Avg. Items/Order</div>
            <div class="insight-main" style="font-size: 20px;">${
              summary.totalOrders > 0
                ? (summary.totalUnitsSold / summary.totalOrders).toFixed(1)
                : 0
            }</div>
          </div>
          <div>
            <div class="insight-stat-label">Fulfillment Rate</div>
            <div class="insight-main" style="color: var(--success); font-size: 20px;">${
              summary.totalOrders > 0
                ? Math.round(
                    (summary.completedCount / summary.totalOrders) * 100
                  )
                : 0
            }%</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderTransactions(input: OrderReportHtmlInput): string {
  return input.orders
    .slice(0, 15)
    .map((order) => {
      const pillState =
        order.payment_status === 'paid'
          ? 'paid'
          : order.payment_status === 'refunded'
            ? 'refunded'
            : 'pending';
      const pillIcon =
        order.payment_status === 'paid'
          ? '✓'
          : order.payment_status === 'refunded'
            ? '↩'
            : '○';

      return `
        <tr>
          <td class="order-id">#${order.id.slice(0, 8).toUpperCase()}</td>
          <td>
            <span class="order-name">${escapeHtml(order.customer_name || 'Anonymous')}</span>
            <span class="order-sub">${format(new Date(order.created_at || input.generatedAt), 'MMM d, yyyy')}</span>
          </td>
          <td style="font-weight: 600; text-transform: capitalize;">${escapeHtml(order.payment_method || 'Online')}</td>
          <td>
            <span class="status-pill pill-${pillState}">
              ${pillIcon}
              ${escapeHtml(order.payment_status?.toUpperCase() ?? 'UNKNOWN')}
            </span>
          </td>
          <td style="font-weight: 800;">${formatCurrency(Number(order.total) || 0)}</td>
        </tr>
      `;
    })
    .join('');
}

export function buildOrderReportHtml(input: OrderReportHtmlInput): string {
  const initial = escapeHtml(
    input.storeName.trim().charAt(0).toUpperCase() || 'B'
  );
  const averageOrderValue =
    input.summary.totalOrders > 0
      ? formatCurrency(
          Math.round(input.summary.totalRevenue / input.summary.totalOrders)
        )
      : formatCurrency(0);

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <style>${orderReportStyles}</style>
      </head>
      <body>
        <div class="header">
          <div class="brand">
            <div class="logo-box">
              ${
                input.logoUrl && /^https?:\/\//i.test(input.logoUrl)
                  ? `<img src="${escapeHtml(input.logoUrl)}" class="logo-img" alt="Store Logo" />`
                  : initial
              }
            </div>
            <div class="brand-info">
              <span class="brand-name">${escapeHtml(input.storeName)}</span>
              <span class="brand-slug">Operations Headquarters</span>
            </div>
          </div>
          <div class="report-meta">
            <div class="report-type">Performance Insights</div>
            <h1 class="report-date">Sales Report</h1>
            <div class="report-period">${escapeHtml(input.dateRangeLabel)}</div>
          </div>
        </div>

        <div class="section-label">Executive Summary</div>

        <div class="hero-grid">
          <div class="hero-card" style="background: linear-gradient(135deg, #10B981 0%, #059669 100%);">
            <div class="label">💰 Total Revenue</div>
            <div class="value">${formatCurrency(input.summary.totalRevenue)}</div>
            <div class="sub">${input.summary.totalOrders} orders completed</div>
            <div class="hero-trend">📈 vs previous period</div>
          </div>
          <div class="hero-card" style="background: linear-gradient(135deg, #4A90D9 0%, #357ABD 100%);">
            <div class="label">🛒 Average Order Value</div>
            <div class="value">${averageOrderValue}</div>
            <div class="sub">Per customer spend</div>
            <div class="hero-trend">💎 Premium indicator</div>
          </div>
        </div>

        <div class="section-label">Order Status Overview</div>

        <div class="status-grid">
          <div class="status-card delivered">
            <div class="status-icon">✅</div>
            <div class="status-count">${input.summary.completedCount}</div>
            <div class="status-label">Delivered</div>
          </div>
          <div class="status-card processing">
            <div class="status-icon">📦</div>
            <div class="status-count">${input.summary.processingCount}</div>
            <div class="status-label">Processing</div>
          </div>
          <div class="status-card pending">
            <div class="status-icon">⏳</div>
            <div class="status-count">${input.summary.pendingCount}</div>
            <div class="status-label">Pending</div>
          </div>
          <div class="status-card" style="background: var(--bg-light);">
            <div class="status-icon">📊</div>
            <div class="status-count">${input.summary.totalUnitsSold}</div>
            <div class="status-label">Units Sold</div>
          </div>
        </div>

        ${renderTopProduct(input)}

        <div class="section-label">Strategic Breakdowns</div>
        <div class="split-grid">
          <div class="board">
            <div class="board-title">Sales by Origin</div>
            ${renderBreakdown(input.summary.salesByOrigin)}
          </div>
          <div class="board">
            <div class="board-title">Payment Method</div>
            ${renderBreakdown(input.summary.salesByPaymentMethod)}
          </div>
        </div>

        <div class="section-label">Financial Position</div>
        <div class="fin-board">
          <div class="fin-title">Financial Summary</div>
          <div class="fin-row"><span class="fin-label">Items Subtotal</span><span class="fin-val">${formatCurrency(input.summary.totalSubtotal)}</span></div>
          <div class="fin-row"><span class="fin-label">Shipping Revenue</span><span class="fin-val positive">+ ${formatCurrency(input.summary.totalShipping)}</span></div>
          <div class="fin-row"><span class="fin-label">Tax (VAT)</span><span class="fin-val positive">+ ${formatCurrency(input.summary.totalTax)}</span></div>
          <div class="fin-row"><span class="fin-label">Total Discounts</span><span class="fin-val negative">- ${formatCurrency(input.summary.totalDiscounts)}</span></div>
          <div class="fin-row total"><span class="fin-label">Net Sales Total</span><span class="fin-val">${formatCurrency(input.summary.totalRevenue)}</span></div>
        </div>

        <div class="table-section">
          <div class="table-title">
            Transaction History
            <span class="badge-count">${input.summary.totalOrders} orders</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Customer</th>
                <th>Method</th>
                <th>Status</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>${renderTransactions(input)}</tbody>
          </table>
          ${
            input.orders.length > 15
              ? `<div style="color: var(--text-muted); font-size: 12px; margin-top: 16px; text-align: center;">+ ${input.orders.length - 15} more orders not shown</div>`
              : ''
          }
        </div>

        <div class="footer">
          <div class="footer-left">
            <div>Report generated on <strong>${format(input.generatedAt, 'MMMM d, yyyy')}</strong></div>
            <div>at <strong>${format(input.generatedAt, 'h:mm a')}</strong></div>
          </div>
          <div class="baci-tag">⚡ Powered by Baci</div>
        </div>
      </body>
    </html>
  `;
}
