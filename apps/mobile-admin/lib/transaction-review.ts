import type {
  TransactionReviewItem,
  TransactionReviewOrder,
  TransactionReviewOrderRow,
} from './transaction-review-types';
import {
  buildSearchText,
  collectDetailValues,
  collectStrings,
  getJoinedProduct,
  getJoinedVariant,
  getSupplierNameFromMetadata,
  getTrimmedString,
  IMEI_KEYS,
  SERIAL_KEYS,
  toFiniteNumberOrNull,
} from './transaction-review-row-helpers';

export const TRANSACTION_REVIEW_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export {
  filterOrdersForTransactionTab,
  formatCostPriceInput,
  formatCostPriceInputText,
  formatPickerDateInput,
  getSupplierOptionsFromOrders,
  parseCostPriceInput,
  parseDateInputForPicker,
  toSentenceCaseSupplierName,
} from './transaction-review-inputs';
export type {
  TransactionReviewItem,
  TransactionReviewOrder,
  TransactionReviewOrderRow,
  TransactionReviewProductRow,
  TransactionReviewVariantRow,
} from './transaction-review-types';
export { getSupplierNameFromMetadata } from './transaction-review-row-helpers';

export function formatTransactionDateInput(createdAt: string) {
  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function buildTransactionReviewRangeFilters(
  startDateIso: string | undefined,
  endDateIso: string | undefined
) {
  return {
    endDateFilter: endDateIso
      ? `transaction_date.lte.${endDateIso},and(transaction_date.is.null,created_at.lte.${endDateIso})`
      : undefined,
    startDateFilter: startDateIso
      ? `transaction_date.gte.${startDateIso},and(transaction_date.is.null,created_at.gte.${startDateIso})`
      : undefined,
  };
}

export function buildTransactionDateIso(dateInput: string) {
  if (!TRANSACTION_REVIEW_DATE_PATTERN.test(dateInput)) {
    return null;
  }

  const [yearText, monthText, dayText] = dateInput.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const parsed = new Date(year, month - 1, day);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed.toISOString();
}

export function mapTransactionOrderRows(rows: TransactionReviewOrderRow[]) {
  return rows.map<TransactionReviewOrder>((order) => {
    const transactionDate = order.transaction_date ?? order.created_at;
    const orderDetailTokens = collectStrings(order.fulfillment_details);
    const items = (order.order_items ?? []).map<TransactionReviewItem>(
      (item) => {
        const product = getJoinedProduct(item.products);
        const variant = getJoinedVariant(item.product_variants);
        const quantity = toFiniteNumberOrNull(item.quantity) ?? 1;
        const unitPrice = toFiniteNumberOrNull(item.price) ?? 0;
        const revenue = unitPrice * quantity;
        const orderItemCostPrice = toFiniteNumberOrNull(item.cost_price);
        const variantCostPrice = toFiniteNumberOrNull(variant?.cost_price);
        const productCostPrice = toFiniteNumberOrNull(product?.cost_price);
        const costPrice =
          orderItemCostPrice ?? variantCostPrice ?? productCostPrice;
        const costSource =
          orderItemCostPrice != null
            ? 'order_item'
            : variantCostPrice != null
              ? 'variant'
              : productCostPrice != null
                ? 'product'
                : null;
        const itemSupplierName = getTrimmedString(item.supplier_name);
        const supplierName =
          itemSupplierName || getSupplierNameFromMetadata(product?.metadata);
        const searchableDetailValues = [
          item.fulfillment_data,
          order.fulfillment_details,
          variant?.attributes,
          product?.fulfillment_details,
          product?.metadata,
        ];
        const imeiValues = collectDetailValues(
          searchableDetailValues,
          IMEI_KEYS
        );
        const serialValues = collectDetailValues(
          searchableDetailValues,
          SERIAL_KEYS
        );

        return {
          costPrice,
          costSource,
          id: item.id,
          imeiValues,
          name: item.name ?? 'Product',
          productId: item.product_id,
          productMatchStatus: item.product_match_status ?? null,
          profit: costPrice == null ? null : revenue - costPrice * quantity,
          quantity,
          revenue,
          searchText: buildSearchText([
            item.id,
            item.name,
            item.price,
            item.quantity,
            item.product_id,
            item.variant_id,
            variant?.sku,
            variant?.condition,
            collectStrings(variant?.attributes),
            product?.sku,
            supplierName,
            collectStrings(item.fulfillment_data),
            collectStrings(product?.fulfillment_details),
            collectStrings(product?.metadata),
          ]),
          serialValues,
          sku: variant?.sku ?? product?.sku ?? null,
          supplierName,
          variantId: item.variant_id ?? null,
        };
      }
    );

    const orderSearchText = buildSearchText([
      order.id,
      order.order_number,
      order.customer_name,
      order.customer_email,
      order.customer_phone,
      order.payment_method,
      transactionDate,
      order.total,
      orderDetailTokens,
      items.map((item) => item.searchText),
    ]);

    return {
      createdAt: transactionDate,
      customerEmail: order.customer_email,
      customerName: order.customer_name ?? 'Customer',
      customerPhone: order.customer_phone,
      estimatedProfit: items.reduce((sum, item) => sum + (item.profit ?? 0), 0),
      id: order.id,
      items,
      missingCostCount: items.filter((item) => item.costPrice == null).length,
      orderNumber: order.order_number ?? order.id.slice(0, 8),
      paymentMethod: order.payment_method ?? 'unknown',
      searchText: orderSearchText,
      total: toFiniteNumberOrNull(order.total) ?? 0,
    };
  });
}

export function filterTransactionOrders(
  orders: TransactionReviewOrder[],
  searchQuery: string
) {
  const terms = searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);

  if (terms.length === 0) {
    return orders;
  }

  return orders.filter((order) =>
    terms.every((term) => order.searchText.includes(term))
  );
}
