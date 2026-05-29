import type { ReceiptMerchant, ReceiptOrder } from '@baci/shared';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  formatReceiptCurrency,
  formatReceiptDate,
} from '@/lib/receipt-pdf-formatters';

interface JsPDFWithAutoTable extends jsPDF {
  lastAutoTable?: {
    finalY: number;
  };
}

function getBrandPrimaryRgb(merchant: ReceiptMerchant) {
  const brandPrimary = merchant.brand_colors?.primary || '#111827';
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(brandPrimary);

  if (!match) {
    return [17, 24, 39] as const;
  }

  return [
    Number.parseInt(match[1], 16),
    Number.parseInt(match[2], 16),
    Number.parseInt(match[3], 16),
  ] as const;
}

function getAddressLines(order: ReceiptOrder) {
  const address = order.shipping_address;
  if (!address) return [];

  return [
    address.address_line1,
    address.address_line2,
    [address.city, address.state].filter(Boolean).join(', '),
    [address.postal_code, address.country].filter(Boolean).join(', '),
  ].filter(Boolean) as string[];
}

function writeWrappedTextLines(input: {
  doc: jsPDF;
  lines: Array<string | null | undefined>;
  x: number;
  y: number;
  maxWidth: number;
  lineHeight?: number;
}) {
  const { doc, lines, x, maxWidth, lineHeight = 5 } = input;
  let currentY = input.y;

  lines.filter(Boolean).forEach((line) => {
    const wrappedLines = doc.splitTextToSize(String(line), maxWidth);
    const lineGroup = Array.isArray(wrappedLines)
      ? wrappedLines
      : [wrappedLines];

    lineGroup.forEach((wrappedLine) => {
      doc.text(wrappedLine, x, currentY);
      currentY += lineHeight;
    });
  });

  return currentY;
}

function getReceiptItemVariantName(item: ReceiptOrder['items'][number]) {
  const candidate = item as ReceiptOrder['items'][number] & {
    variant_name?: unknown;
  };

  if (typeof candidate.variant_name !== 'string') {
    return null;
  }

  const variantName = candidate.variant_name.trim();
  return variantName.length > 0 ? variantName : null;
}

export function generateReceiptPDF(
  order: ReceiptOrder,
  merchant: ReceiptMerchant
) {
  const doc = new jsPDF() as JsPDFWithAutoTable;
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  const columnGap = 12;
  const columnWidth = (contentWidth - columnGap) / 2;
  const currency = order.currency || 'NGN';
  const isPaid = order.payment_status === 'paid';
  const brandPrimaryRgb = getBrandPrimaryRgb(merchant);
  let y = margin;

  doc.setFillColor(...brandPrimaryRgb);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 24, 4, 4, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(isPaid ? 'RECEIPT' : 'INVOICE', margin + 8, y + 10);
  doc.setFontSize(10);
  doc.text(`#${order.order_number}`, pageWidth - margin - 8, y + 10, {
    align: 'right',
  });
  doc.text(
    formatReceiptDate(order.created_at),
    pageWidth - margin - 8,
    y + 17,
    {
      align: 'right',
    }
  );
  y += 34;

  doc.setTextColor(17, 24, 39);
  doc.setFontSize(15);
  y = writeWrappedTextLines({
    doc,
    lines: [merchant.legal_entity_name || merchant.business_name || 'Store'],
    x: margin,
    y,
    maxWidth: columnWidth,
    lineHeight: 6,
  });
  y += 1;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  y = writeWrappedTextLines({
    doc,
    lines: [
      merchant.business_address,
      merchant.support_phone || merchant.phone,
      merchant.support_email || merchant.email,
      merchant.tax_identification_number
        ? `TIN: ${merchant.tax_identification_number}`
        : null,
    ],
    x: margin,
    y,
    maxWidth: columnWidth,
  });

  const rightColumnX = margin + columnWidth + columnGap;
  let rightY = margin + 36;
  doc.setFont('helvetica', 'bold');
  doc.text('Billed To', rightColumnX, rightY);
  rightY += 6;
  doc.setFont('helvetica', 'normal');
  rightY = writeWrappedTextLines({
    doc,
    lines: [
      order.customer_name,
      order.customer_email,
      order.customer_phone,
      ...getAddressLines(order),
    ],
    x: rightColumnX,
    y: rightY,
    maxWidth: columnWidth,
  });

  y = Math.max(y, rightY) + 6;

  autoTable(doc, {
    startY: y,
    head: [['Item', 'Qty', 'Unit Price', 'Line Total']],
    body: (order.items || []).map((item) => {
      const variantName = getReceiptItemVariantName(item);

      return [
        variantName
          ? `${item.product_name || item.name || 'Item'} (${variantName})`
          : item.product_name || item.name || 'Item',
        String(item.quantity),
        formatReceiptCurrency(item.price, currency),
        formatReceiptCurrency(item.quantity * item.price, currency),
      ];
    }),
    styles: {
      fontSize: 10,
      cellPadding: 4,
      lineColor: [229, 231, 235],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [...brandPrimaryRgb],
      textColor: [255, 255, 255],
    },
    pageBreak: 'auto',
  });

  y = (doc.lastAutoTable?.finalY || y) + 10;
  const totalsX = pageWidth - margin - 68;
  const ensureSpace = (spaceNeeded: number) => {
    const pageHeight = doc.internal.pageSize.getHeight();

    if (y + spaceNeeded <= pageHeight - margin) {
      return;
    }

    doc.addPage();
    y = margin;
  };
  const writeSummaryRow = (
    label: string,
    value: string,
    emphasized = false
  ) => {
    ensureSpace(8);
    doc.setFont('helvetica', emphasized ? 'bold' : 'normal');
    doc.text(label, totalsX, y);
    doc.text(value, pageWidth - margin, y, { align: 'right' });
    y += 6;
  };

  const formatSummaryAmount = (value: number | null | undefined) =>
    formatReceiptCurrency(
      typeof value === 'number' && Number.isFinite(value) ? value : 0,
      currency
    );

  writeSummaryRow('Subtotal', formatSummaryAmount(order.subtotal));
  writeSummaryRow(
    'Shipping',
    order.shipping_fee > 0 ? formatSummaryAmount(order.shipping_fee) : 'Free'
  );

  if (order.discount_amount > 0) {
    writeSummaryRow(
      'Discount',
      `-${formatSummaryAmount(order.discount_amount)}`
    );
  }

  if (order.tax_amount > 0) {
    writeSummaryRow('Tax', formatSummaryAmount(order.tax_amount));
  }

  writeSummaryRow('Total', formatSummaryAmount(order.total), true);

  if (!isPaid || order.amount_paid > 0) {
    writeSummaryRow('Amount Paid', formatSummaryAmount(order.amount_paid));
    if (order.balance > 0) {
      writeSummaryRow('Balance Due', formatSummaryAmount(order.balance), true);
    }
  }

  if (order.transactions && order.transactions.length > 0) {
    y += 4;
    ensureSpace(20);
    autoTable(doc, {
      startY: y,
      head: [['Payment Date', 'Method', 'Amount']],
      body: order.transactions.map((tx) => [
        formatReceiptDate(tx.created_at),
        tx.metadata?.payment_method || tx.description || 'Payment',
        formatReceiptCurrency(tx.amount, currency),
      ]),
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [31, 41, 55],
        textColor: [255, 255, 255],
      },
      pageBreak: 'auto',
    });
    y = (doc.lastAutoTable?.finalY || y) + 8;
  }

  if (!isPaid && (order.virtual_account || merchant.bank_account_number)) {
    ensureSpace(24);
    doc.setFont('helvetica', 'bold');
    doc.text('Payment Instructions', margin, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    const bankLines = order.virtual_account
      ? [
          `Bank: ${order.virtual_account.bank_name}`,
          `Account Name: ${order.virtual_account.account_name}`,
          `Account Number: ${order.virtual_account.account_number}`,
        ]
      : ([
          merchant.bank_name ? `Bank: ${merchant.bank_name}` : null,
          merchant.bank_account_name || merchant.business_name
            ? `Account Name: ${merchant.bank_account_name || merchant.business_name}`
            : null,
          merchant.bank_account_number
            ? `Account Number: ${merchant.bank_account_number}`
            : null,
        ].filter(Boolean) as string[]);

    y = writeWrappedTextLines({
      doc,
      lines: bankLines,
      x: margin,
      y,
      maxWidth: contentWidth,
    });
  }

  return doc;
}

export function generateReceiptBlob(
  order: ReceiptOrder,
  merchant: ReceiptMerchant
) {
  return generateReceiptPDF(order, merchant).output('blob');
}
