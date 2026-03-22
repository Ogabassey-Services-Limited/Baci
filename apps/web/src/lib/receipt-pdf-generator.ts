import type { ReceiptMerchant, ReceiptOrder } from '@baci/shared';
import { jsPDF } from 'jspdf/dist/jspdf.es.min.js';
import autoTable from 'jspdf-autotable';

interface JsPDFWithAutoTable extends jsPDF {
  lastAutoTable?: {
    finalY: number;
  };
}

const CURRENCY_LOCALE_MAP: Record<string, string> = {
  NGN: 'en-NG',
  GHS: 'en-GH',
  KES: 'en-KE',
  USD: 'en-US',
  GBP: 'en-GB',
  EUR: 'de-DE',
  ZAR: 'en-ZA',
  XAF: 'fr-CM',
  XOF: 'fr-SN',
};

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat(CURRENCY_LOCALE_MAP[currency] || 'en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
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

export function generateReceiptPDF(
  order: ReceiptOrder,
  merchant: ReceiptMerchant
) {
  const doc = new jsPDF() as JsPDFWithAutoTable;
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;
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
  doc.text(formatDate(order.created_at), pageWidth - margin - 8, y + 17, {
    align: 'right',
  });
  y += 34;

  doc.setTextColor(17, 24, 39);
  doc.setFontSize(15);
  doc.text(
    merchant.legal_entity_name || merchant.business_name || 'Store',
    margin,
    y
  );
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  [
    merchant.business_address,
    merchant.support_phone || merchant.phone,
    merchant.support_email || merchant.email,
    merchant.tax_identification_number
      ? `TIN: ${merchant.tax_identification_number}`
      : null,
  ]
    .filter(Boolean)
    .forEach((line) => {
      doc.text(String(line), margin, y);
      y += 5;
    });

  const rightColumnX = pageWidth / 2 + 8;
  let rightY = margin + 36;
  doc.setFont('helvetica', 'bold');
  doc.text('Billed To', rightColumnX, rightY);
  rightY += 6;
  doc.setFont('helvetica', 'normal');
  [
    order.customer_name,
    order.customer_email,
    order.customer_phone,
    ...getAddressLines(order),
  ]
    .filter(Boolean)
    .forEach((line) => {
      doc.text(String(line), rightColumnX, rightY);
      rightY += 5;
    });

  y = Math.max(y, rightY) + 6;

  autoTable(doc, {
    startY: y,
    head: [['Item', 'Qty', 'Unit Price', 'Line Total']],
    body: (order.items || []).map((item) => [
      item.product_name || item.name || 'Item',
      String(item.quantity),
      formatCurrency(item.price, currency),
      formatCurrency(item.quantity * item.price, currency),
    ]),
    styles: {
      fontSize: 10,
      cellPadding: 4,
      lineColor: [229, 231, 235],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [...brandPrimaryRgb],
      textColor: '#ffffff',
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

  writeSummaryRow('Subtotal', formatCurrency(order.subtotal, currency));
  writeSummaryRow(
    'Shipping',
    order.shipping_fee > 0
      ? formatCurrency(order.shipping_fee, currency)
      : 'Free'
  );

  if (order.discount_amount > 0) {
    writeSummaryRow(
      'Discount',
      `-${formatCurrency(order.discount_amount, currency)}`
    );
  }

  if (order.tax_amount > 0) {
    writeSummaryRow('Tax', formatCurrency(order.tax_amount, currency));
  }

  writeSummaryRow('Total', formatCurrency(order.total, currency), true);

  if (!isPaid || order.amount_paid > 0) {
    writeSummaryRow('Amount Paid', formatCurrency(order.amount_paid, currency));
    if (order.balance > 0) {
      writeSummaryRow(
        'Balance Due',
        formatCurrency(order.balance, currency),
        true
      );
    }
  }

  if (order.transactions && order.transactions.length > 0) {
    y += 4;
    ensureSpace(20);
    autoTable(doc, {
      startY: y,
      head: [['Payment Date', 'Method', 'Amount']],
      body: order.transactions.map((tx) => [
        formatDate(tx.created_at),
        tx.metadata?.payment_method || tx.description || 'Payment',
        formatCurrency(tx.amount, currency),
      ]),
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [31, 41, 55],
        textColor: '#ffffff',
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

    bankLines.forEach((line) => {
      doc.text(line, margin, y);
      y += 5;
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
