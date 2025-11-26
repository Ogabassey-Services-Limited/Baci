import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AnalyticsData } from '@/components/analytics/draggable-analytics-grid';

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
  const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
  return `${from.toLocaleDateString('en-US', options)} - ${to.toLocaleDateString('en-US', options)}`;
}

/**
 * Export analytics data as CSV
 */
export function exportAnalyticsAsCSV(
  data: AnalyticsData,
  dateRange?: { from: Date | undefined; to: Date | undefined },
  merchantName?: string
): void {
  const { summary, recentSales, chartData } = data;

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
    csvRows.push(`Total Revenue,${formatCurrency(summary.revenue?.value || 0)},${formatPercentage(summary.revenue?.change || 0)}`);
    csvRows.push(`Total Sales,${summary.sales?.value || 0},${formatPercentage(summary.sales?.change || 0)}`);
    csvRows.push(`Total Customers,${summary.customers?.value || 0},${formatPercentage(summary.customers?.change || 0)}`);
    csvRows.push(`Average Order Value,${formatCurrency(summary.aov?.value || 0)},${formatPercentage(summary.aov?.change || 0)}`);
    csvRows.push(`Customer Lifetime Value,${formatCurrency(summary.ltv?.value || 0)},${formatPercentage(summary.ltv?.change || 0)}`);
    csvRows.push(`Gross Margin,${summary.grossMargin?.value || 0}%,${formatPercentage(summary.grossMargin?.change || 0)}`);
    csvRows.push(`Refund Rate,${(summary.refundRate?.value || 0).toFixed(2)}%,${formatPercentage(summary.refundRate?.change || 0)}`);
    csvRows.push(`Active Now,${summary.activeNow?.value || 0},${formatPercentage(summary.activeNow?.change || 0)}`);
  }

  csvRows.push(''); // Empty line

  // Recent Sales Section
  if (recentSales && recentSales.length > 0) {
    csvRows.push('RECENT SALES');
    csvRows.push('Customer,Email,Amount');
    recentSales.forEach((sale) => {
      csvRows.push(`"${sale.name}","${sale.email}",${formatCurrency(sale.amount)}`);
    });
    csvRows.push(''); // Empty line
  }

  // Chart Data Section
  if (chartData && chartData.length > 0) {
    csvRows.push('REVENUE OVER TIME');
    const hasMonthData = 'month' in chartData[0];
    const headerRow = hasMonthData ? 'Month,Desktop,Mobile,Total' : 'Day,Desktop,Mobile,Total';
    csvRows.push(headerRow);

    chartData.forEach((item) => {
      const period = 'month' in item ? item.month : 'day' in item ? item.day : '';
      const desktop = item.desktop || 0;
      const mobile = item.mobile || 0;
      const total = desktop + mobile;
      csvRows.push(`"${period}",${formatCurrency(desktop)},${formatCurrency(mobile)},${formatCurrency(total)}`);
    });
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
}

/**
 * Export analytics data as PDF
 */
export function exportAnalyticsAsPDF(
  data: AnalyticsData,
  dateRange?: { from: Date | undefined; to: Date | undefined },
  merchantName?: string
): void {
  const { summary, recentSales, chartData } = data;

  // Create new PDF document
  const doc = new jsPDF();

  // Title
  doc.setFontSize(20);
  doc.setTextColor(40);
  doc.text(`Analytics Report`, 14, 22);

  // Merchant name
  doc.setFontSize(12);
  doc.setTextColor(100);
  doc.text(merchantName || 'Your Store', 14, 30);

  // Date range
  doc.setFontSize(10);
  doc.setTextColor(150);
  doc.text(`Period: ${formatDateRange(dateRange?.from, dateRange?.to)}`, 14, 37);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 43);

  let yPosition = 55;

  // Summary Metrics Table
  if (summary) {
    doc.setFontSize(14);
    doc.setTextColor(40);
    doc.text('Summary Metrics', 14, yPosition);
    yPosition += 5;

    const summaryData = [
      ['Total Revenue', formatCurrency(summary.revenue?.value || 0), formatPercentage(summary.revenue?.change || 0)],
      ['Total Sales', String(summary.sales?.value || 0), formatPercentage(summary.sales?.change || 0)],
      ['Total Customers', String(summary.customers?.value || 0), formatPercentage(summary.customers?.change || 0)],
      ['Average Order Value', formatCurrency(summary.aov?.value || 0), formatPercentage(summary.aov?.change || 0)],
      ['Customer LTV', formatCurrency(summary.ltv?.value || 0), formatPercentage(summary.ltv?.change || 0)],
      ['Gross Margin', `${summary.grossMargin?.value || 0}%`, formatPercentage(summary.grossMargin?.change || 0)],
      ['Refund Rate', `${(summary.refundRate?.value || 0).toFixed(2)}%`, formatPercentage(summary.refundRate?.change || 0)],
      ['Active Now', String(summary.activeNow?.value || 0), formatPercentage(summary.activeNow?.change || 0)],
    ];

    autoTable(doc, {
      startY: yPosition,
      head: [['Metric', 'Value', 'Change']],
      body: summaryData,
      theme: 'grid',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    yPosition = (doc as any).lastAutoTable.finalY + 15;
  }

  // Recent Sales Table
  if (recentSales && recentSales.length > 0 && yPosition < 250) {
    doc.setFontSize(14);
    doc.setTextColor(40);
    doc.text('Recent Sales', 14, yPosition);
    yPosition += 5;

    const salesData = recentSales.map((sale) => [
      sale.name,
      sale.email,
      formatCurrency(sale.amount),
    ]);

    autoTable(doc, {
      startY: yPosition,
      head: [['Customer', 'Email', 'Amount']],
      body: salesData,
      theme: 'grid',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    yPosition = (doc as any).lastAutoTable.finalY + 15;
  }

  // Add new page if needed
  if (yPosition > 250) {
    doc.addPage();
    yPosition = 20;
  }

  // Revenue Over Time Table
  if (chartData && chartData.length > 0) {
    doc.setFontSize(14);
    doc.setTextColor(40);
    doc.text('Revenue Over Time', 14, yPosition);
    yPosition += 5;

    const hasMonthData = 'month' in chartData[0];
    const chartDataFormatted = chartData.map((item) => {
      const period = 'month' in item ? item.month : 'day' in item ? item.day : '';
      const desktop = item.desktop || 0;
      const mobile = item.mobile || 0;
      const total = desktop + mobile;
      return [
        period,
        formatCurrency(desktop),
        formatCurrency(mobile),
        formatCurrency(total),
      ];
    });

    autoTable(doc, {
      startY: yPosition,
      head: [[hasMonthData ? 'Month' : 'Day', 'Desktop', 'Mobile', 'Total']],
      body: chartDataFormatted,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
    });
  }

  // Save PDF
  doc.save(`analytics-report-${Date.now()}.pdf`);
}
