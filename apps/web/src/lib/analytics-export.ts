// Use browser ESM bundle to avoid Turbopack resolving jspdf.node.min.js (fflate dynamic worker error).
import { jsPDF } from 'jspdf/dist/jspdf.es.min.js';
import autoTable from 'jspdf-autotable';
import type { AnalyticsData } from '@/components/analytics/draggable-analytics-grid';

// Extended jsPDF type with autotable and internal properties (2026 best practice)
interface JsPDFWithAutoTable extends jsPDF {
  lastAutoTable?: {
    finalY: number;
  };
}

// Type for accessing jsPDF internal methods (doesn't extend jsPDF to avoid type conflicts)
interface JsPDFWithInternal {
  internal: {
    getNumberOfPages: () => number;
  };
}

/**
 * Format currency for display
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

/**
 * Format percentage for display
 */
function formatPercentage(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

/**
 * Format date range for display
 */
function formatDateRange(from?: Date, to?: Date): string {
  if (!from || !to) return 'All Time';
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  };
  return `${from.toLocaleDateString('en-US', options)} - ${to.toLocaleDateString('en-US', options)}`;
}

/**
 * Escape a CSV field to prevent CSV injection and handle special characters
 * - Escapes double quotes by doubling them
 * - Wraps in quotes if contains special characters
 * - Prevents formula injection by prefixing dangerous characters with single quote
 */
function escapeCSVField(field: string): string {
  if (!field) return '""';

  // Convert to string and trim
  let escaped = String(field).trim();

  // Prevent formula injection: prefix with single quote if starts with =, +, -, @, tab, or CR
  if (/^[=+\-@\t\r]/.test(escaped)) {
    escaped = `'${escaped}`;
  }

  // Escape existing double quotes by doubling them
  escaped = escaped.replace(/"/g, '""');

  // Always wrap in quotes for safety
  return `"${escaped}"`;
}

/**
 * Export analytics data as CSV
 */
export function exportAnalyticsAsCSV(
  data: AnalyticsData,
  dateRange?: { from: Date | undefined; to: Date | undefined },
  merchantName?: string
): void {
  const {
    summary,
    recentSales,
    // chartData, // Unused
    salesByChannel,
    salesByPaymentMethod,
  } = data;

  // Build CSV content
  const csvRows: string[] = [];

  // Header
  csvRows.push(`Analytics Report - ${merchantName || 'Your Store'}`);
  csvRows.push(`Period: ${formatDateRange(dateRange?.from, dateRange?.to)}`);
  csvRows.push(`Generated: ${new Date().toLocaleString()}`);
  csvRows.push(''); // Empty line

  // Summary Section
  csvRows.push('SUMMARY METRICS');
  csvRows.push('Metric,Value,Change');

  if (summary) {
    csvRows.push(
      `Total Revenue,${formatCurrency(summary.revenue?.value || 0)},${formatPercentage(summary.revenue?.change || 0)}`
    );
    csvRows.push(
      `Total Sales,${summary.sales?.value || 0},${formatPercentage(summary.sales?.change || 0)}`
    );
    csvRows.push(`Total Units Sold,${summary.totalUnitsSold || 0},0%`);
    csvRows.push(
      `Total Customers,${summary.customers?.value || 0},${formatPercentage(summary.customers?.change || 0)}`
    );
    csvRows.push(
      `Average Order Value,${formatCurrency(summary.aov?.value || 0)},${formatPercentage(summary.aov?.change || 0)}`
    );
  }

  csvRows.push(''); // Empty line

  // Financial Breakdown
  if (summary) {
    csvRows.push('FINANCIAL BREAKDOWN');
    csvRows.push('Item,Amount');
    csvRows.push(`Subtotal,${formatCurrency(summary.subtotal || 0)}`);
    csvRows.push(`Shipping,${formatCurrency(summary.shipping || 0)}`);
    csvRows.push(`Tax,${formatCurrency(summary.tax || 0)}`);
    csvRows.push(`Discounts,${formatCurrency(summary.discounts || 0)}`);
    csvRows.push(`Net Total,${formatCurrency(summary.revenue?.value || 0)}`);
    csvRows.push('');
  }

  // Sales by Channel
  if (salesByChannel && salesByChannel.length > 0) {
    csvRows.push('SALES BY CHANNEL');
    csvRows.push('Channel,Revenue');
    salesByChannel.forEach((c) => {
      csvRows.push(`${c.name},${formatCurrency(c.value)}`);
    });
    csvRows.push('');
  }

  // Sales by Payment Method
  if (salesByPaymentMethod && salesByPaymentMethod.length > 0) {
    csvRows.push('SALES BY PAYMENT METHOD');
    csvRows.push('Method,Revenue');
    salesByPaymentMethod.forEach((p) => {
      csvRows.push(`${p.name},${formatCurrency(p.value)}`);
    });
    csvRows.push('');
  }

  // Recent Sales Section
  if (recentSales && recentSales.length > 0) {
    csvRows.push('RECENT SALES');
    csvRows.push('Customer,Email,Amount,Date');
    recentSales.forEach((sale) => {
      csvRows.push(
        `${escapeCSVField(sale.name)},${escapeCSVField(sale.email)},${formatCurrency(sale.amount)},${new Date(sale.time).toLocaleDateString()}`
      );
    });
    csvRows.push(''); // Empty line
  }

  // Create and download CSV file
  const csvContent = csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', `analytics-report-${Date.now()}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export analytics data as PDF
 */
export function exportAnalyticsAsPDF(
  data: AnalyticsData,
  dateRange?: { from: Date | undefined; to: Date | undefined },
  merchantName?: string
): void {
  const {
    summary,
    recentSales,
    salesByChannel,
    salesByPaymentMethod,
    topProducts,
  } = data;

  // Create new PDF document
  const doc = new jsPDF();

  // Premium Header Styling
  doc.setFillColor(74, 144, 217); // #4A90D9 (Baci Primary)
  doc.rect(0, 0, 210, 40, 'F');

  doc.setFontSize(24);
  doc.setTextColor(255);
  doc.setFont('helvetica', 'bold');
  doc.text('PERFORMANCE REPORT', 14, 20);

  doc.setFontSize(10);
  doc.setTextColor(255);
  doc.setFont('helvetica', 'normal');
  doc.text(merchantName?.toUpperCase() || 'YOUR STORE', 14, 28);
  doc.text(
    `PERIOD: ${formatDateRange(dateRange?.from, dateRange?.to).toUpperCase()}`,
    14,
    34
  );

  let yPosition = 55;

  // Key performance cards (drawn as rectangles)
  if (summary) {
    // Gross Sales Card
    doc.setFillColor(248, 250, 252); // var(--bg-light)
    doc.roundedRect(14, yPosition, 85, 30, 3, 3, 'F');
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text('GROSS REVENUE', 20, yPosition + 10);
    doc.setFontSize(18);
    doc.setTextColor(16, 185, 129); // Success color
    doc.text(formatCurrency(summary.revenue?.value || 0), 20, yPosition + 22);

    // Orders Card
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(110, yPosition, 85, 30, 3, 3, 'F');
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text('TOTAL ORDERS', 116, yPosition + 10);
    doc.setFontSize(18);
    doc.setTextColor(74, 144, 217); // Primary color
    doc.text(String(summary.sales?.value || 0), 116, yPosition + 22);

    yPosition += 40;

    // AOV & Units Sold
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, yPosition, 85, 20, 3, 3, 'F');
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text('AVG ORDER VALUE', 20, yPosition + 8);
    doc.setFontSize(12);
    doc.setTextColor(40);
    doc.text(formatCurrency(summary.aov?.value || 0), 20, yPosition + 16);

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(110, yPosition, 85, 20, 3, 3, 'F');
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text('UNITS SOLD', 116, yPosition + 8);
    doc.setFontSize(12);
    doc.setTextColor(40);
    doc.text(String(summary.totalUnitsSold || 0), 116, yPosition + 16);

    yPosition += 35;

    // Financial Board (Colored dark card)
    doc.setFillColor(15, 23, 42); // slate-900
    doc.roundedRect(14, yPosition, 181, 65, 4, 4, 'F');

    doc.setFontSize(12);
    doc.setTextColor(255);
    doc.text('Financial Position', 24, yPosition + 12);

    doc.setFontSize(10);
    doc.setTextColor(200);
    doc.text('Items Subtotal', 24, yPosition + 24);
    doc.text(formatCurrency(summary.subtotal || 0), 190, yPosition + 24, {
      align: 'right',
    });

    doc.text('Shipping Revenue', 24, yPosition + 32);
    doc.text(
      `+ ${formatCurrency(summary.shipping || 0)}`,
      190,
      yPosition + 32,
      { align: 'right' }
    );

    doc.text('Tax (VAT)', 24, yPosition + 40);
    doc.text(`+ ${formatCurrency(summary.tax || 0)}`, 190, yPosition + 40, {
      align: 'right',
    });

    doc.setTextColor(239, 68, 68); // light red
    doc.text('Discounts', 24, yPosition + 48);
    doc.text(
      `- ${formatCurrency(summary.discounts || 0)}`,
      190,
      yPosition + 48,
      { align: 'right' }
    );

    doc.setDrawColor(255, 255, 255, 0.2);
    doc.line(24, yPosition + 54, 185, yPosition + 54);

    doc.setFontSize(14);
    doc.setTextColor(255);
    doc.text('Net Total', 24, yPosition + 61);
    doc.text(formatCurrency(summary.revenue?.value || 0), 190, yPosition + 61, {
      align: 'right',
    });

    yPosition += 85;
  }

  // Strategic Breakdowns Section
  doc.setFontSize(14);
  doc.setTextColor(40);
  doc.text('Strategic Breakdowns', 14, yPosition);
  yPosition += 5;

  const originData = (salesByChannel || []).map((c) => [
    c.name,
    formatCurrency(c.value),
  ]);
  const paymentData = (salesByPaymentMethod || []).map((p) => [
    p.name,
    formatCurrency(p.value),
  ]);

  autoTable(doc, {
    startY: yPosition,
    head: [['Sales by Origin', 'Revenue']],
    body: originData.length > 0 ? originData : [['No data', '$0.00']],
    theme: 'striped',
    styles: { fontSize: 9 },
    headStyles: { fillColor: [74, 144, 217] },
    margin: { left: 14, right: 110 },
  });

  autoTable(doc, {
    startY: yPosition,
    head: [['Payment Method', 'Revenue']],
    body: paymentData.length > 0 ? paymentData : [['No data', '$0.00']],
    theme: 'striped',
    styles: { fontSize: 9 },
    headStyles: { fillColor: [74, 144, 217] },
    margin: { left: 110, right: 14 },
  });

  yPosition = (doc as JsPDFWithAutoTable).lastAutoTable?.finalY ?? yPosition;
  yPosition += 20;

  // Top Products and Recent Sales on new page
  doc.addPage();
  yPosition = 20;

  if (topProducts && topProducts.length > 0) {
    doc.setFontSize(14);
    doc.setTextColor(40);
    doc.text('Top Selling Products', 14, yPosition);
    yPosition += 5;

    autoTable(doc, {
      startY: yPosition,
      head: [['Product Name', 'Revenue', 'Units sold']],
      body: topProducts.map((p) => [
        p.name,
        formatCurrency(p.revenue),
        String(p.units || 0),
      ]),
      theme: 'grid',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [74, 144, 217] },
    });

    yPosition = (doc as JsPDFWithAutoTable).lastAutoTable?.finalY ?? yPosition;
    yPosition += 15;
  }

  if (recentSales && recentSales.length > 0) {
    doc.setFontSize(14);
    doc.setTextColor(40);
    doc.text('Recent Transactions', 14, yPosition);
    yPosition += 5;

    autoTable(doc, {
      startY: yPosition,
      head: [['Customer', 'Date', 'Amount']],
      body: recentSales.map((s) => [
        s.name,
        new Date(s.time).toLocaleDateString(),
        formatCurrency(s.amount),
      ]),
      theme: 'grid',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [74, 144, 217] },
    });
  }

  // Footer on all pages
  // Note: jsPDF internal API is not fully typed, so we use unknown intermediate cast (2026 best practice)
  const pageCount = (
    doc as unknown as JsPDFWithInternal
  ).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Page ${i} of ${pageCount}`, 105, 285, { align: 'center' });
    doc.text(
      `Generated on ${new Date().toLocaleString()} • Baci Admin`,
      14,
      285
    );
  }

  // Save PDF
  doc.save(`analytics-report-${Date.now()}.pdf`);
}
