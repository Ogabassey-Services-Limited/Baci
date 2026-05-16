import type { Order } from '@baci/shared';
import { escapeHtml } from '@baci/shared';
import { format } from 'date-fns';
import type * as PrintType from 'expo-print';
import type * as SharingType from 'expo-sharing';
import { Platform } from 'react-native';

// 2026 Best Practice: Dynamic imports for native modules to prevent evaluation-time crashes
let Print: typeof PrintType | null = null;
let Sharing: typeof SharingType | null = null;

const loadNativeModules = async () => {
  if (Platform.OS === 'web') return;
  try {
    const [prnt, shr] = await Promise.all([
      import('expo-print'),
      import('expo-sharing'),
    ]);
    Print = prnt;
    Sharing = shr;
  } catch (e) {
    console.debug(
      '[ExportOrders] Native modules ignored or failed to load:',
      e
    );
  }
};

// Initiate non-blocking load
loadNativeModules();

import { supabase } from '@/lib/supabase';

// Helper to escape CSV fields with formula injection prevention
const escapeCtx = (text: unknown) => {
  if (text === null || text === undefined) return '';
  let str = String(text);
  // Prevent CSV formula injection: prefix dangerous starting characters
  // that spreadsheet apps (Excel, Google Sheets) interpret as formulas
  if (/^[=+\-@]/.test(str)) {
    str = `'${str}`;
  }
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export const generateOrdersCSV = (orders: Order[]): string => {
  const headers = [
    'Order Number',
    'Customer Name',
    'Customer Email',
    'Customer Phone',
    'Date',
    'Status',
    'Payment Status',
    'Total',
    'Items',
    'Address',
    'City',
    'State',
  ];

  const rows = orders.map((order) =>
    [
      order.order_number,
      order.customer_name,
      order.customer_email,
      order.customer_phone,
      format(new Date(order.created_at), 'yyyy-MM-dd HH:mm:ss'),
      order.shipping_status,
      order.payment_status,
      order.total,
      order.item_count || 0, // Assuming OrderWithCount type or simplified
      order.shipping_address?.address_line1,
      order.shipping_address?.city,
      order.shipping_address?.state,
    ]
      .map(escapeCtx)
      .join(',')
  );

  return [headers.join(','), ...rows].join('\n');
};

export const exportOrdersRPC = async (orders: Order[]) => {
  try {
    if (!Sharing) await loadNativeModules();
    if (!Sharing) throw new Error('Export modules not available');

    const csvData = generateOrdersCSV(orders);
    const filename = `orders_report_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`;

    const { File, Paths } = await import('expo-file-system');
    const csvFile = new File(Paths.document, filename);
    csvFile.write(csvData);
    const fileUri = csvFile.uri;

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: 'Export Orders Report',
        UTI: 'public.comma-separated-values-text',
      });
    } else {
      throw new Error('Sharing is not available on this device');
    }
  } catch (error) {
    console.error('Export failed:', error);
    throw error;
  }
};

// ... existing generateOrdersCSV ...

export const exportOrderReportPDF = async (
  orders: Order[],
  dateRangeLabel: string,
  storeName: string = 'My Store',
  logoUrl?: string
) => {
  if (!Print || !Sharing) await loadNativeModules();
  if (!Print || !Sharing) throw new Error('Export modules not available');
  try {
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce(
      (sum, o) => sum + (Number(o.total) || 0),
      0
    );
    const totalSubtotal = orders.reduce(
      (sum, o) => sum + (Number(o.subtotal) || 0),
      0
    );
    const totalShipping = orders.reduce(
      (sum, o) => sum + (Number(o.shipping_fee) || 0),
      0
    );
    const totalDiscounts = orders.reduce(
      (sum, o) => sum + (Number(o.discount_amount) || 0),
      0
    );
    // Note: tax_amount is in DB but might not be in shared type yet - calculating as difference or 0
    const totalTax = orders.reduce(
      (sum, o) => sum + (Number(o.tax_amount) || 0),
      0
    );

    const pendingCount = orders.filter(
      (o) => o.shipping_status === 'pending'
    ).length;
    const processingCount = orders.filter(
      (o) => o.shipping_status === 'processing'
    ).length;
    const completedCount = orders.filter(
      (o) => o.shipping_status === 'delivered'
    ).length;

    // Grouping Helpers
    const groupBy = <T extends { total?: number | string | null }>(
      array: T[],
      keyGetter: (item: T) => string
    ) => {
      const map = new Map<string, { count: number; total: number }>();
      array.forEach((item) => {
        const key = keyGetter(item) || 'Unknown';
        const current = map.get(key) || { count: 0, total: 0 };
        map.set(key, {
          count: current.count + 1,
          total: current.total + (Number(item.total) || 0),
        });
      });
      return Array.from(map.entries()).sort((a, b) => b[1].total - a[1].total);
    };

    const salesByOrigin = groupBy(orders, (o) => o.source || 'Direct');
    const salesByPaymentMethod = groupBy(
      orders,
      (o) => o.payment_method || 'Other'
    );

    // Fetch Item Details for deep insights
    let totalUnitsSold = 0;
    let topProduct: { name: string; qty: number; revenue: number } | null =
      null;

    interface OrderItemQueryData {
      product_id: string;
      quantity: number;
      price: number;
      products: { name: string } | null;
    }

    try {
      const orderIds = orders.map((o) => o.id);
      if (orderIds.length > 0) {
        const { data: itemData, error: itemError } = await supabase
          .from('order_items')
          .select('product_id, quantity, price, products(name)')
          .in('order_id', orderIds)
          .returns<OrderItemQueryData[]>();

        if (itemError) {
          console.warn('Failed to fetch order items:', itemError.message);
        }

        totalUnitsSold =
          itemData?.reduce(
            (sum, item) => sum + (Number(item.quantity) || 0),
            0
          ) || 0;

        const productStats: Record<
          string,
          { name: string; qty: number; revenue: number }
        > = {};
        itemData?.forEach((item) => {
          const name = item.products?.name || 'Unknown Product';
          if (!productStats[name])
            productStats[name] = { name, qty: 0, revenue: 0 };
          productStats[name].qty += Number(item.quantity) || 0;
          productStats[name].revenue +=
            (Number(item.quantity) || 0) * (Number(item.price) || 0);
        });
        topProduct =
          Object.values(productStats).sort((a, b) => b.qty - a.qty)[0] || null;
      }
    } catch (err) {
      console.warn('Failed to fetch item data for report:', err);
    }

    const html = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

          :root {
            --primary: #4A90D9;
            --primary-dark: #357ABD;
            --success: #10B981;
            --success-bg: rgba(16, 185, 129, 0.1);
            --warning: #F59E0B;
            --warning-bg: rgba(245, 158, 11, 0.1);
            --danger: #EF4444;
            --danger-bg: rgba(239, 68, 68, 0.1);
            --purple: #8B5CF6;
            --purple-bg: rgba(139, 92, 246, 0.1);
            --text-main: #0F172A;
            --text-muted: #64748B;
            --bg-light: #F8FAFC;
            --border: #E2E8F0;
            --card-bg: #FFFFFF;
          }

          * { box-sizing: border-box; }
          body {
            font-family: 'Plus Jakarta Sans', sans-serif;
            margin: 0;
            padding: 40px;
            color: var(--text-main);
            background: #fff;
            line-height: 1.6;
          }

          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 40px;
            padding-bottom: 24px;
            border-bottom: 2px solid var(--border);
          }

          .brand { display: flex; align-items: center; gap: 16px; }
          .logo-box {
            width: 64px;
            height: 64px;
            border-radius: 16px;
            object-fit: cover;
            background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 800;
            font-size: 28px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(74, 144, 217, 0.3);
          }
          .logo-img { width: 100%; height: 100%; object-fit: cover; }
          .brand-info { display: flex; flex-direction: column; }
          .brand-name { font-size: 22px; font-weight: 800; color: var(--text-main); }
          .brand-slug { font-size: 13px; color: var(--text-muted); font-weight: 500; }

          .report-meta { text-align: right; }
          .report-type { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; color: var(--primary); margin-bottom: 4px; }
          .report-date { font-size: 32px; font-weight: 800; margin: 0; color: var(--text-main); }
          .report-period { display: inline-block; background: var(--bg-light); padding: 6px 14px; border-radius: 20px; font-size: 12px; color: var(--text-muted); font-weight: 600; margin-top: 10px; border: 1px solid var(--border); }

          .section-label {
            font-size: 13px;
            font-weight: 800;
            text-transform: uppercase;
            color: var(--text-muted);
            margin-bottom: 20px;
            letter-spacing: 1.5px;
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .section-label::after { content: ""; flex: 1; height: 1px; background: linear-gradient(to right, var(--border), transparent); }

          .hero-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 24px;
            margin-bottom: 32px;
          }
          .hero-card {
            padding: 28px 32px;
            border-radius: 20px;
            color: white;
            position: relative;
            overflow: hidden;
          }
          .hero-card::before {
            content: "";
            position: absolute;
            top: -50%;
            right: -30%;
            width: 200px;
            height: 200px;
            background: rgba(255,255,255,0.1);
            border-radius: 50%;
          }
          .hero-card .label { font-size: 14px; font-weight: 600; opacity: 0.9; margin-bottom: 8px; }
          .hero-card .value { font-size: 38px; font-weight: 800; margin-bottom: 4px; letter-spacing: -1px; }
          .hero-card .sub { font-size: 13px; opacity: 0.85; font-weight: 500; }
          .hero-trend {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            background: rgba(255,255,255,0.2);
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 700;
            margin-top: 10px;
          }

          .status-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 16px;
            margin-bottom: 32px;
          }
          .status-card {
            padding: 20px;
            border-radius: 16px;
            text-align: center;
            border: 1px solid var(--border);
          }
          .status-card.delivered { background: var(--success-bg); border-color: var(--success); }
          .status-card.processing { background: var(--purple-bg); border-color: var(--purple); }
          .status-card.pending { background: var(--warning-bg); border-color: var(--warning); }
          .status-card.cancelled { background: var(--danger-bg); border-color: var(--danger); }
          .status-icon { font-size: 24px; margin-bottom: 8px; }
          .status-count { font-size: 28px; font-weight: 800; color: var(--text-main); }
          .status-label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px; }

          .metrics-row {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 16px;
            margin-bottom: 32px;
          }
          .metric-box {
            background: var(--bg-light);
            padding: 20px;
            border-radius: 16px;
            border: 1px solid var(--border);
          }
          .metric-label { font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px; }
          .metric-value { font-size: 20px; font-weight: 800; color: var(--text-main); }

          .insights-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 24px;
            margin-bottom: 32px;
          }

          .insight-card {
            border: 1px solid var(--border);
            padding: 24px;
            border-radius: 20px;
            background: var(--bg-light);
          }
          .insight-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
          .insight-title { font-size: 16px; font-weight: 800; color: var(--text-main); }
          .insight-badge {
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            padding: 4px 10px;
            border-radius: 20px;
            letter-spacing: 0.5px;
          }
          .badge-success { background: var(--success-bg); color: var(--success); }
          .badge-warning { background: var(--warning-bg); color: var(--warning); }
          .insight-content { display: flex; justify-content: space-between; align-items: flex-end; }
          .insight-main { font-size: 24px; font-weight: 800; color: var(--text-main); }
          .insight-sub { font-size: 12px; color: var(--text-muted); font-weight: 500; }
          .insight-stat { text-align: right; }
          .insight-stat-label { font-size: 10px; color: var(--text-muted); text-transform: uppercase; font-weight: 700; }
          .insight-stat-value { font-size: 16px; font-weight: 800; color: var(--success); }

          .split-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 32px;
            margin-bottom: 32px;
          }

          .board { background: #fff; }
          .board-title { font-size: 16px; font-weight: 800; margin-bottom: 16px; color: var(--text-main); display: flex; align-items: center; gap: 8px; }
          .board-title::before { content: ""; width: 4px; height: 20px; background: var(--primary); border-radius: 2px; }

          .list-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 14px 18px;
            background: var(--bg-light);
            border-radius: 14px;
            margin-bottom: 10px;
            border: 1px solid var(--border);
            transition: all 0.2s;
          }
          .item-info { display: flex; flex-direction: column; }
          .item-name { font-size: 14px; font-weight: 700; color: var(--text-main); text-transform: capitalize; }
          .item-count { font-size: 11px; color: var(--text-muted); font-weight: 500; }
          .item-val { font-size: 15px; font-weight: 800; color: var(--text-main); }

          .fin-board {
            background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%);
            color: #fff;
            padding: 32px;
            border-radius: 24px;
            margin-bottom: 32px;
            position: relative;
            overflow: hidden;
          }
          .fin-board::before {
            content: "";
            position: absolute;
            top: -100px;
            right: -100px;
            width: 300px;
            height: 300px;
            background: radial-gradient(circle, rgba(74, 144, 217, 0.15) 0%, transparent 70%);
          }
          .fin-title { font-size: 16px; font-weight: 700; margin-bottom: 24px; display: flex; align-items: center; gap: 10px; }
          .fin-title::before { content: "🏦"; }
          .fin-row { display: flex; justify-content: space-between; margin-bottom: 14px; font-size: 15px; opacity: 0.85; }
          .fin-row.total { border-top: 1px solid rgba(255,255,255,0.15); padding-top: 18px; margin-top: 18px; opacity: 1; font-weight: 800; font-size: 22px; }
          .fin-label { font-weight: 500; }
          .fin-val { font-weight: 700; }
          .fin-val.positive { color: var(--success); }
          .fin-val.negative { color: var(--danger); }

          .table-section { margin-bottom: 40px; }
          .table-title { font-size: 18px; font-weight: 800; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; }
          .badge-count { font-size: 12px; background: var(--primary); color: white; padding: 4px 12px; border-radius: 20px; font-weight: 700; }

          table { width: 100%; border-collapse: separate; border-spacing: 0 10px; }
          th {
            text-align: left;
            padding: 14px 20px;
            font-size: 11px;
            color: var(--text-muted);
            text-transform: uppercase;
            font-weight: 800;
            letter-spacing: 1px;
            background: var(--bg-light);
          }
          th:first-child { border-radius: 12px 0 0 12px; }
          th:last-child { border-radius: 0 12px 12px 0; }
          td {
            background: var(--bg-light);
            padding: 16px 20px;
            font-size: 13px;
            color: var(--text-main);
            border-top: 1px solid var(--border);
            border-bottom: 1px solid var(--border);
          }
          td:first-child { border-radius: 12px 0 0 12px; border-left: 1px solid var(--border); }
          td:last-child { border-radius: 0 12px 12px 0; border-right: 1px solid var(--border); }

          .order-id { font-family: 'SF Mono', monospace; font-weight: 700; color: var(--primary); font-size: 12px; }
          .order-name { font-weight: 700; display: block; }
          .order-sub { font-size: 11px; color: var(--text-muted); }

          .status-pill {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
          }
          .pill-paid { background: var(--success-bg); color: var(--success); }
          .pill-pending { background: var(--warning-bg); color: var(--warning); }
          .pill-refunded { background: var(--danger-bg); color: var(--danger); }

          .footer {
            margin-top: 48px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-top: 24px;
            border-top: 2px solid var(--border);
            font-size: 12px;
            color: var(--text-muted);
          }
          .footer-left { display: flex; flex-direction: column; gap: 4px; }
          .baci-tag {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-weight: 800;
            color: var(--primary);
            background: rgba(74, 144, 217, 0.1);
            padding: 6px 14px;
            border-radius: 20px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="brand">
            <div class="logo-box">
              ${logoUrl && /^https?:\/\//i.test(logoUrl) ? `<img src="${escapeHtml(logoUrl)}" class="logo-img" alt="Store Logo" />` : escapeHtml(storeName.charAt(0).toUpperCase())}
            </div>
            <div class="brand-info">
              <span class="brand-name">${escapeHtml(storeName)}</span>
              <span class="brand-slug">Operations Headquarters</span>
            </div>
          </div>
          <div class="report-meta">
            <div class="report-type">Performance Insights</div>
            <h1 class="report-date">Sales Report</h1>
            <div class="report-period">${escapeHtml(dateRangeLabel)}</div>
          </div>
        </div>

        <div class="section-label">Executive Summary</div>

        <div class="hero-grid">
          <div class="hero-card" style="background: linear-gradient(135deg, #10B981 0%, #059669 100%);">
            <div class="label">💰 Total Revenue</div>
            <div class="value">₦${totalRevenue.toLocaleString()}</div>
            <div class="sub">${totalOrders} orders completed</div>
            <div class="hero-trend">📈 vs previous period</div>
          </div>
          <div class="hero-card" style="background: linear-gradient(135deg, #4A90D9 0%, #357ABD 100%);">
            <div class="label">🛒 Average Order Value</div>
            <div class="value">₦${totalOrders > 0 ? (totalRevenue / totalOrders).toLocaleString(undefined, { maximumFractionDigits: 0 }) : 0}</div>
            <div class="sub">Per customer spend</div>
            <div class="hero-trend">💎 Premium indicator</div>
          </div>
        </div>

        <div class="section-label">Order Status Overview</div>

        <div class="status-grid">
          <div class="status-card delivered">
            <div class="status-icon">✅</div>
            <div class="status-count">${completedCount}</div>
            <div class="status-label">Delivered</div>
          </div>
          <div class="status-card processing">
            <div class="status-icon">📦</div>
            <div class="status-count">${processingCount}</div>
            <div class="status-label">Processing</div>
          </div>
          <div class="status-card pending">
            <div class="status-icon">⏳</div>
            <div class="status-count">${pendingCount}</div>
            <div class="status-label">Pending</div>
          </div>
          <div class="status-card" style="background: var(--bg-light);">
            <div class="status-icon">📊</div>
            <div class="status-count">${totalUnitsSold}</div>
            <div class="status-label">Units Sold</div>
          </div>
        </div>

        ${
          topProduct
            ? `
        <div class="section-label">Top Performer</div>
        <div class="insights-grid">
          <div class="insight-card">
            <div class="insight-header">
              <div class="insight-title">🔥 Best Selling Product</div>
              <span class="insight-badge badge-success">Top Seller</span>
            </div>
            <div class="insight-content">
              <div>
                <div class="insight-main">${escapeHtml(topProduct.name)}</div>
                <div class="insight-sub">${topProduct.qty} units sold this period</div>
              </div>
              <div class="insight-stat">
                <div class="insight-stat-label">Revenue</div>
                <div class="insight-stat-value">₦${topProduct.revenue.toLocaleString()}</div>
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
                <div class="insight-main" style="font-size: 20px;">${totalOrders > 0 ? (totalUnitsSold / totalOrders).toFixed(1) : 0}</div>
              </div>
              <div>
                <div class="insight-stat-label">Fulfillment Rate</div>
                <div class="insight-main" style="font-size: 20px; color: var(--success);">${totalOrders > 0 ? Math.round((completedCount / totalOrders) * 100) : 0}%</div>
              </div>
            </div>
          </div>
        </div>
        `
            : ''
        }

        <div class="section-label">Strategic Breakdowns</div>

        <div class="split-grid">
          <div class="board">
            <div class="board-title">Sales by Origin</div>
            ${salesByOrigin
              .map(
                ([name, data]) => `
              <div class="list-item">
                <div class="item-info">
                  <span class="item-name">${escapeHtml(name)}</span>
                  <span class="item-count">${data.count} orders</span>
                </div>
                <div class="item-val">₦${data.total.toLocaleString()}</div>
              </div>
            `
              )
              .join('')}
          </div>

          <div class="board">
            <div class="board-title">Payment Method</div>
            ${salesByPaymentMethod
              .map(
                ([name, data]) => `
              <div class="list-item">
                <div class="item-info">
                  <span class="item-name">${escapeHtml(name)}</span>
                  <span class="item-count">${data.count} orders</span>
                </div>
                <div class="item-val">₦${data.total.toLocaleString()}</div>
              </div>
            `
              )
              .join('')}
          </div>
        </div>

        <div class="section-label">Financial Position</div>

        <div class="fin-board">
          <div class="fin-title">Financial Summary</div>
          <div class="fin-row">
            <span class="fin-label">Items Subtotal</span>
            <span class="fin-val">₦${totalSubtotal.toLocaleString()}</span>
          </div>
          <div class="fin-row">
            <span class="fin-label">Shipping Revenue</span>
            <span class="fin-val positive">+ ₦${totalShipping.toLocaleString()}</span>
          </div>
           <div class="fin-row">
            <span class="fin-label">Tax (VAT)</span>
            <span class="fin-val positive">+ ₦${totalTax.toLocaleString()}</span>
          </div>
          <div class="fin-row">
            <span class="fin-label">Total Discounts</span>
            <span class="fin-val negative">- ₦${totalDiscounts.toLocaleString()}</span>
          </div>
          <div class="fin-row total">
            <span class="fin-label">Net Sales Total</span>
            <span class="fin-val">₦${totalRevenue.toLocaleString()}</span>
          </div>
        </div>

        <div class="table-section">
          <div class="table-title">
            Transaction History
            <span class="badge-count">${totalOrders} orders</span>
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
            <tbody>
              ${orders
                .slice(0, 15)
                .map(
                  (o) => `
                <tr>
                  <td class="order-id">#${o.id.slice(0, 8).toUpperCase()}</td>
                  <td>
                    <span class="order-name">${escapeHtml(o.customer_name || 'Anonymous')}</span>
                    <span class="order-sub">${format(new Date(o.created_at || new Date()), 'MMM d, yyyy')}</span>
                  </td>
                  <td style="text-transform: capitalize; font-weight: 600;">${escapeHtml(o.payment_method || 'Online')}</td>
                  <td>
                    <span class="status-pill pill-${o.payment_status === 'paid' ? 'paid' : o.payment_status === 'refunded' ? 'refunded' : 'pending'}">
                      ${o.payment_status === 'paid' ? '✓' : o.payment_status === 'refunded' ? '↩' : '○'}
                      ${escapeHtml(o.payment_status?.toUpperCase() ?? 'UNKNOWN')}
                    </span>
                  </td>
                  <td style="font-weight: 800;">₦${(Number(o.total) || 0).toLocaleString()}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
          ${orders.length > 15 ? `<div style="text-align: center; font-size: 12px; color: var(--text-muted); margin-top: 16px;">+ ${orders.length - 15} more orders not shown</div>` : ''}
        </div>

        <div class="footer">
          <div class="footer-left">
            <div>Report generated on <strong>${format(new Date(), 'MMMM d, yyyy')}</strong></div>
            <div>at <strong>${format(new Date(), 'h:mm a')}</strong></div>
          </div>
          <div class="baci-tag">⚡ Powered by Baci</div>
        </div>
      </body>
    </html>
    `;

    const { uri } = await Print.printToFileAsync({ html });
    await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};
