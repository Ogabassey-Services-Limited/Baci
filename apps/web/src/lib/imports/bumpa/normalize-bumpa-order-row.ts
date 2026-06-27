import { sanitizeText } from '@/lib/sanitize-core';
import {
  type ParsedBumpaRichItem,
  parseBumpaRichItems,
} from './parse-bumpa-rich-items';

type RawBumpaOrderRow = Record<string, string>;

function firstText(row: RawBumpaOrderRow, ...keys: string[]) {
  for (const key of keys) {
    const value = sanitizeText(row[key] || '');
    if (value) return value;
  }

  return '';
}

function joinName(...parts: string[]) {
  return parts
    .map((part) => sanitizeText(part))
    .filter(Boolean)
    .join(' ');
}

function pipeJoin(values: string[]) {
  return values
    .map((value) => sanitizeText(value))
    .filter(Boolean)
    .join(' | ');
}

function richItemNames(items: ParsedBumpaRichItem[]) {
  return pipeJoin(items.map((item) => item.productName));
}

function richItemSkus(items: ParsedBumpaRichItem[]) {
  return pipeJoin(items.map((item) => item.sku || ''));
}

function richItemQuantities(items: ParsedBumpaRichItem[]) {
  return pipeJoin(
    items.map((item) => (item.quantity === null ? '' : String(item.quantity)))
  );
}

export function normalizeBumpaOrderRow(
  rawRow: RawBumpaOrderRow
): RawBumpaOrderRow {
  const richItems = parseBumpaRichItems(rawRow.items_json || '');

  return {
    ...rawRow,
    id: firstText(rawRow, 'id'),
    'Order Number': firstText(rawRow, 'Order Number', 'order_number'),
    Products:
      firstText(rawRow, 'Products', 'items_names', 'product_names') ||
      richItemNames(richItems),
    'Customer Name':
      firstText(rawRow, 'Customer Name', 'customer_name') ||
      joinName(
        firstText(rawRow, 'customer_first_name'),
        firstText(rawRow, 'customer_last_name')
      ) ||
      joinName(
        firstText(rawRow, 'shipping_first_name'),
        firstText(rawRow, 'shipping_last_name')
      ),
    'Customer Email': firstText(
      rawRow,
      'Customer Email',
      'customer_email',
      'shipping_email'
    ),
    'Customer Phone': firstText(
      rawRow,
      'Customer Phone',
      'customer_phone',
      'shipping_phone',
      'customer_alternative_phone',
      'shipping_alternative_phone'
    ),
    'Payment Status': firstText(rawRow, 'Payment Status', 'payment_status'),
    Status: firstText(rawRow, 'Status', 'status'),
    'Shipping Status': firstText(rawRow, 'Shipping Status', 'shipping_status'),
    Channel: firstText(rawRow, 'Channel', 'channel'),
    Origin: firstText(rawRow, 'Origin', 'origin'),
    Total: firstText(rawRow, 'Total', 'total', 'grand_total'),
    'Sub Total': firstText(rawRow, 'Sub Total', 'sub_total', 'subtotal'),
    Discount: firstText(rawRow, 'Discount', 'discount', 'total_discount'),
    'Amount Paid': firstText(rawRow, 'Amount Paid', 'amount_paid'),
    'Amount Due': firstText(rawRow, 'Amount Due', 'amount_due'),
    'Order Date': firstText(rawRow, 'Order Date', 'order_date'),
    'Created At': firstText(rawRow, 'Created At', 'created_at'),
    'Updated At': firstText(rawRow, 'Updated At', 'updated_at'),
    'Shipping Price': firstText(
      rawRow,
      'Shipping Price',
      'shipping_price',
      'shipping_option_price'
    ),
    Tax: firstText(rawRow, 'Tax', 'tax'),
    'Coupon Code': firstText(rawRow, 'Coupon Code', 'coupon_code'),
    'Shipping Option': firstText(
      rawRow,
      'Shipping Option',
      'shipping_option_name',
      'shipping_option_description'
    ),
    'Product SKU':
      firstText(rawRow, 'Product SKU', 'product_sku', 'product_skus') ||
      richItemSkus(richItems),
    'Product Quantity':
      firstText(rawRow, 'Product Quantity', 'product_quantity') ||
      richItemQuantities(richItems),
    items_json: rawRow.items_json || '',
  };
}
