import type { ReceiptOrder } from '@baci/shared';
import type { InvoiceLineItem } from '@/lib/invoice-generator';

type ReceiptItem = ReceiptOrder['items'][number];

function normalizeKeyPart(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, ' ').toLowerCase() || null;
}

function amountKey(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value)
    ? String(Math.round(value * 100))
    : null;
}

function quantityKey(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value)
    ? String(value)
    : null;
}

function uniqueLineKey(lineId: number | null | undefined) {
  return typeof lineId === 'number' && Number.isFinite(lineId)
    ? `line:${lineId}`
    : null;
}

function uniqueSellerKey(sellersItemId: string | null | undefined) {
  const normalized = normalizeKeyPart(sellersItemId);
  return normalized ? `seller:${normalized}` : null;
}

function productQuantityPriceKey(
  productId: string | null | undefined,
  quantity: number | null | undefined,
  price: number | null | undefined
) {
  const normalizedProductId = normalizeKeyPart(productId);
  const normalizedQuantity = quantityKey(quantity);
  const normalizedPrice = amountKey(price);

  return normalizedProductId && normalizedQuantity && normalizedPrice
    ? `product:${normalizedProductId}:${normalizedQuantity}:${normalizedPrice}`
    : null;
}

function nameQuantityPriceKey(
  name: string | null | undefined,
  quantity: number | null | undefined,
  price: number | null | undefined
) {
  const normalizedName = normalizeKeyPart(name);
  const normalizedQuantity = quantityKey(quantity);
  const normalizedPrice = amountKey(price);

  return normalizedName && normalizedQuantity && normalizedPrice
    ? `name:${normalizedName}:${normalizedQuantity}:${normalizedPrice}`
    : null;
}

function invoiceItemKeys(item: InvoiceLineItem) {
  return [
    uniqueLineKey(item.line_id),
    uniqueSellerKey(item.sellers_item_id),
    productQuantityPriceKey(item.product_id, item.quantity, item.price),
    nameQuantityPriceKey(item.name, item.quantity, item.price),
  ].filter((key): key is string => key !== null);
}

function receiptItemKeys(item: ReceiptItem) {
  return [
    uniqueLineKey(item.line_id),
    uniqueSellerKey(item.sellers_item_id),
    productQuantityPriceKey(item.product_id, item.quantity, item.price),
    nameQuantityPriceKey(
      item.product_name || item.name,
      item.quantity,
      item.price
    ),
  ].filter((key): key is string => key !== null);
}

function buildUniqueInvoiceItemLookup(invoiceItems: InvoiceLineItem[]) {
  const lookup = new Map<string, InvoiceLineItem>();
  const duplicateKeys = new Set<string>();

  for (const item of invoiceItems) {
    for (const key of invoiceItemKeys(item)) {
      if (lookup.has(key)) {
        duplicateKeys.add(key);
        lookup.delete(key);
        continue;
      }

      if (!duplicateKeys.has(key)) {
        lookup.set(key, item);
      }
    }
  }

  return lookup;
}

function findInvoiceItemForReceiptItem(
  item: ReceiptItem,
  lookup: Map<string, InvoiceLineItem>
) {
  for (const key of receiptItemKeys(item)) {
    const invoiceItem = lookup.get(key);
    if (invoiceItem) {
      return invoiceItem;
    }
  }

  return null;
}

export function mergeReceiptItemsWithInvoiceMetadata(
  receiptItems: ReceiptItem[],
  invoiceItems: InvoiceLineItem[]
): ReceiptItem[] {
  const invoiceLookup = buildUniqueInvoiceItemLookup(invoiceItems);

  return receiptItems.map((item) => {
    const invoiceItem = findInvoiceItemForReceiptItem(item, invoiceLookup);

    if (!invoiceItem) {
      return item;
    }

    return {
      ...item,
      description: invoiceItem.description ?? item.description,
      line_extension_amount:
        invoiceItem.line_extension_amount ?? item.line_extension_amount,
      sellers_item_id: invoiceItem.sellers_item_id ?? item.sellers_item_id,
      unit_code: invoiceItem.unit_code ?? item.unit_code,
      vat_amount: invoiceItem.vat_amount ?? item.vat_amount,
      vat_category_code:
        invoiceItem.vat_category_code ?? item.vat_category_code,
      vat_rate: invoiceItem.vat_rate ?? item.vat_rate,
    };
  });
}
