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

  const receiptMerchant: ReceiptMerchant = {
    business_name: merchant.business_name,
    logo_url: merchant.logo_url,
    email: merchant.email || '',
    phone: merchant.phone,
    support_email: merchant.support_email,
    support_phone: merchant.support_phone,
    business_address: merchant.business_address,
    cac_rc_number: merchant.cac_rc_number,
    tax_identification_number: merchant.tax_identification_number,
    legal_entity_name: merchant.legal_entity_name,
    brand_colors: asRecord(
      merchant.brand_colors
    ) as ReceiptMerchant['brand_colors'],
    vat_registration_status: merchant.vat_registration_status,
    vat_rate: merchant.vat_rate,
    bank_code: merchant.bank_code,
    bank_account_number: merchant.bank_account_number,
    bank_name: merchant.bank_name,
    bank_account_name: merchant.bank_account_name,
    social_media: asRecord(
      merchant.social_media
    ) as ReceiptMerchant['social_media'],
    pages: asRecord(merchant.pages) as ReceiptMerchant['pages'],
  };

  const receiptOrder: ReceiptOrder = {
    order_number: order.order_number,
    created_at: order.created_at,
    currency,
    total,
    subtotal,
    shipping_fee: shippingFee,
    tax_amount: taxAmount,
    discount_amount: discountAmount,
    amount_paid: amountPaid,
    balance,
    payment_status: paymentStatus,
    payment_method: order.payment_method,
    is_credit_order: Boolean(order.is_credit_order),
    customer_name: customerName,
    customer_email: customerEmail,
    customer_phone: customerPhone,
    shipping_address: shippingAddress,
    virtual_account: paymentAccount
      ? {
          account_number: paymentAccount.account_number,
          bank_name: paymentAccount.bank_name || '',
          account_name: paymentAccount.account_name || '',
        }
      : null,
    items: orderItems.map((item) => ({
      product_name: item.product_name || item.name,
      quantity: item.quantity,
      price: item.price,
    })),
    transactions: transactions.map((transaction) => ({
      amount: asNumber(transaction.amount),
      created_at: transaction.created_at,
      description: transaction.description,
      metadata: transaction.metadata,
    })),
  };

  const invoiceItems: InvoiceLineItem[] = orderItems.map((item, index) => ({
    line_id: index + 1,
    product_id: item.product_id || undefined,
    name: item.product_name || item.name,
    quantity: item.quantity,
    unit_code: 'EA',
    price: item.price,
    line_extension_amount: item.quantity * item.price,
    vat_category_code: 'S',
    vat_rate: merchant.vat_rate ?? 7.5,
    vat_amount: 0,
  }));

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
      vat_rate: merchant.vat_rate ?? 7.5,
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
    notes: order.notes || null,
    transactions: receiptOrder.transactions || [],
    virtual_account: receiptOrder.virtual_account || null,
  };

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
    tax_exclusive_amount:
      order.tax_exclusive_amount == null
        ? subtotal
        : asNumber(order.tax_exclusive_amount),
    tax_amount: taxAmount,
    tax_inclusive_amount:
      order.tax_inclusive_amount == null
        ? total
        : asNumber(order.tax_inclusive_amount),
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
