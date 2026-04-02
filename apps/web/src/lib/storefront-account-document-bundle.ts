import type { ReceiptMerchant, ReceiptOrder } from '@baci/shared';
import type {
  InvoiceData,
  InvoiceLineItem,
  TaxSubtotal,
} from '@/lib/invoice-generator';
import type {
  StorefrontAccountDocumentCustomerRow,
  StorefrontAccountDocumentItemRow,
  StorefrontAccountDocumentMerchantRow,
  StorefrontAccountDocumentOrderRow,
  StorefrontAccountDocumentPaymentAccountRow,
  StorefrontAccountDocumentTaxSubtotalRow,
  StorefrontAccountDocumentTransactionRow,
} from '@/lib/storefront-account-document-bundle.types';
import {
  buildReceiptMerchant,
  buildReceiptOrder,
} from '@/lib/storefront-account-document-receipt';
import {
  asNumber,
  asRecord,
  asString,
  buildCustomerAddress,
  buildOrderItems,
  normalizeShippingAddress,
} from '@/lib/storefront-account-document-values';
import type { StorefrontOrder } from '@/types/storefront-order';

interface BuildStorefrontAccountDocumentBundleInput {
  merchant: StorefrontAccountDocumentMerchantRow;
  customer: StorefrontAccountDocumentCustomerRow;
  order: StorefrontAccountDocumentOrderRow;
  itemRows: StorefrontAccountDocumentItemRow[];
  transactions: StorefrontAccountDocumentTransactionRow[];
  paymentAccount: StorefrontAccountDocumentPaymentAccountRow | null;
  taxRows: StorefrontAccountDocumentTaxSubtotalRow[];
  paymentStatus: string;
  shippingStatus: string;
  currentDocumentKind: 'invoice' | 'receipt';
}

function resolveMoneyValue(
  value: number | string | null | undefined,
  fallback: number
) {
  return value == null ? fallback : asNumber(value);
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

export function buildStorefrontAccountDocumentBundle({
  merchant,
  customer,
  order,
  itemRows,
  transactions,
  paymentAccount,
  taxRows,
  paymentStatus,
  shippingStatus,
  currentDocumentKind,
}: BuildStorefrontAccountDocumentBundleInput) {
  const currency = asString(order.currency) || 'NGN';
  const total = asNumber(order.total);
  const subtotal = asNumber(order.subtotal);
  const shippingFee = asNumber(order.shipping_fee);
  const taxAmount = asNumber(order.tax_amount);
  const discountAmount = asNumber(order.discount_amount);
  const amountPaid = asNumber(order.amount_paid);
  const balance = Math.max(0, total - amountPaid);
  const shippingAddress = normalizeShippingAddress(order.shipping_address);
  const orderItems = buildOrderItems(itemRows);
  const fallbackName = [customer.first_name, customer.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();
  const customerName =
    asString(order.customer_name) || fallbackName || 'Customer';
  const customerEmail = asString(order.customer_email) || customer.email || '';
  const customerPhone =
    asString(order.customer_phone) || customer.phone || null;
  const receiptEligible = currentDocumentKind === 'receipt';
  const registeredAddress = asRecord(merchant.registered_address);
  const invoiceVatRate = merchant.vat_rate ?? 7.5;
  const lineExtensionTotal = orderItems.reduce(
    (totalAmount, item) => totalAmount + item.quantity * item.price,
    0
  );
  const singleTaxSubtotal = taxRows.length === 1 ? taxRows[0] : null;
  const lineVatCategoryCode =
    singleTaxSubtotal?.vat_category_code || (taxRows.length === 0 ? 'S' : null);
  const lineVatRate =
    singleTaxSubtotal != null
      ? asNumber(singleTaxSubtotal.vat_rate)
      : taxRows.length === 0
        ? invoiceVatRate
        : null;
  let allocatedVatAmount = 0;

  const receiptMerchant: ReceiptMerchant = buildReceiptMerchant(merchant);
  const receiptOrder: ReceiptOrder = buildReceiptOrder({
    order,
    orderItems,
    transactions,
    paymentAccount,
    paymentStatus,
    shippingAddress,
    currency,
    total,
    subtotal,
    shippingFee,
    taxAmount,
    discountAmount,
    amountPaid,
    balance,
    customerName,
    customerEmail,
    customerPhone,
  });

  const invoiceItems: InvoiceLineItem[] = orderItems.map((item, index) => {
    const lineExtensionAmount = item.quantity * item.price;
    const vatAmount =
      lineVatCategoryCode &&
      lineVatRate != null &&
      taxAmount > 0 &&
      lineExtensionTotal > 0
        ? index === orderItems.length - 1
          ? roundCurrency(taxAmount - allocatedVatAmount)
          : roundCurrency(
              (lineExtensionAmount / lineExtensionTotal) * taxAmount
            )
        : null;

    if (vatAmount != null) {
      allocatedVatAmount += vatAmount;
    }

    return {
      line_id: index + 1,
      product_id: item.product_id || undefined,
      name: item.variant_name
        ? `${item.product_name || item.name} (${item.variant_name})`
        : item.product_name || item.name,
      quantity: item.quantity,
      unit_code: 'EA',
      price: item.price,
      line_extension_amount: lineExtensionAmount,
      ...(lineVatCategoryCode && lineVatRate != null
        ? {
            vat_category_code: lineVatCategoryCode,
            vat_rate: lineVatRate,
            vat_amount: vatAmount ?? 0,
          }
        : {}),
    };
  });

  const taxSubtotals: TaxSubtotal[] = taxRows.map((subtotalRow) => ({
    vat_category_code: subtotalRow.vat_category_code,
    vat_rate: asNumber(subtotalRow.vat_rate),
    taxable_amount: asNumber(subtotalRow.taxable_amount),
    tax_amount: asNumber(subtotalRow.tax_amount),
    exemption_reason: subtotalRow.exemption_reason || undefined,
  }));

  if (taxSubtotals.length === 0 && taxAmount > 0) {
    taxSubtotals.push({
      vat_category_code: 'S',
      vat_rate: invoiceVatRate,
      taxable_amount: subtotal,
      tax_amount: taxAmount,
    });
  }

  const orderDetail: StorefrontOrder = {
    id: order.id,
    order_number: order.order_number,
    created_at: order.created_at,
    updated_at: order.updated_at || undefined,
    shipping_status: shippingStatus,
    payment_status: paymentStatus,
    tracking_number: order.tracking_number || undefined,
    subtotal,
    total,
    shipping_fee: shippingFee,
    shipping_cost: shippingFee,
    shipping_provider: order.shipping_provider || undefined,
    shipping_address: shippingAddress,
    payment_method: order.payment_method || undefined,
    payment_provider: order.payment_method || undefined,
    paymentMethod: order.payment_method || undefined,
    items: orderItems,
    currency,
    amount_paid: amountPaid,
    tax_amount: taxAmount,
    discount_amount: discountAmount,
    balance,
    current_document_kind: currentDocumentKind,
    receipt_eligible: receiptEligible,
    customer_name: customerName,
    customer_email: customerEmail,
    customer_phone: customerPhone,
    merchant_support_email: merchant.support_email || null,
    merchant_support_phone: merchant.support_phone || null,
    rider_phone_number: merchant.rider_phone_number || null,
    notes: order.notes || null,
    transactions: transactions.map((transaction) => ({
      id: transaction.id || undefined,
      amount: asNumber(transaction.amount),
      created_at: transaction.created_at,
      description: transaction.description,
      metadata: transaction.metadata,
    })),
    virtual_account: receiptOrder.virtual_account || null,
  };

  const taxInclusiveAmount = resolveMoneyValue(
    order.tax_inclusive_amount,
    total
  );
  const preTaxTotal = Math.max(0, taxInclusiveAmount - taxAmount);

  const invoiceData: InvoiceData = {
    invoice_number: order.order_number,
    invoice_type_code: order.invoice_type_code || '380',
    issue_date: new Date(order.invoice_issue_date || order.created_at),
    tax_point_date: order.tax_point_date
      ? new Date(order.tax_point_date)
      : undefined,
    due_date: order.payment_due_date
      ? new Date(order.payment_due_date)
      : undefined,
    currency,
    buyer_reference: order.buyer_reference || undefined,
    purchase_order_reference: order.purchase_order_reference || undefined,
    merchant: {
      business_name: merchant.business_name,
      legal_entity_name: merchant.legal_entity_name || undefined,
      tax_identification_number:
        merchant.tax_identification_number || undefined,
      cac_rc_number: merchant.cac_rc_number || undefined,
      vat_registration_status:
        merchant.vat_registration_status || 'unregistered',
      vat_rate: merchant.vat_rate ?? 0,
      registered_address: registeredAddress
        ? {
            street: asString(registeredAddress.street),
            city: asString(registeredAddress.city),
            state: asString(registeredAddress.state),
            postal_code: asString(registeredAddress.postal_code),
            country: asString(registeredAddress.country),
          }
        : undefined,
      support_email: merchant.support_email || undefined,
      support_phone: merchant.support_phone || undefined,
      logo_url: merchant.logo_url || undefined,
    },
    customer: {
      name: customerName,
      email: customerEmail || undefined,
      phone: customerPhone || undefined,
      address: buildCustomerAddress(shippingAddress),
    },
    items: invoiceItems,
    tax_subtotals: taxSubtotals,
    subtotal,
    tax_exclusive_amount: resolveMoneyValue(
      order.tax_exclusive_amount,
      preTaxTotal
    ),
    tax_amount: taxAmount,
    tax_inclusive_amount: taxInclusiveAmount,
    shipping_fee: shippingFee,
    discount_amount: discountAmount,
    total,
    notes: order.invoice_note || order.notes || undefined,
    payment_terms: order.payment_terms || undefined,
    firs_irn: order.firs_irn || undefined,
    firs_csid: order.firs_csid || undefined,
    firs_qr_code: order.firs_qr_code || undefined,
  };

  return {
    order: orderDetail,
    invoiceData,
    receiptOrder,
    receiptMerchant,
  };
}
