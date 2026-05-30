import type {
  TransactionReviewItem,
  TransactionReviewOrder,
  TransactionReviewOrderRow,
  TransactionReviewProductRow,
  TransactionReviewVariantRow,
} from './transaction-review-types';

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

const SUPPLIER_METADATA_KEYS = [
  'supplier_name',
  'supplier',
  'vendor_name',
  'vendor',
] as const;

const IMEI_KEYS = new Set(['imei', 'imei_number', 'imeiNumber']);
const SERIAL_KEYS = new Set(['serial', 'serial_number', 'serialNumber', 's/n']);

function getJoinedProduct(
  value: TransactionReviewProductRow | TransactionReviewProductRow[] | null
) {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function getJoinedVariant(
  value:
    | TransactionReviewVariantRow
    | TransactionReviewVariantRow[]
    | null
    | undefined
) {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function getTrimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function toFiniteNumberOrNull(value: unknown) {
  if (value == null) {
    return null;
  }

  if (typeof value === 'string' && value.trim() === '') {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function collectStrings(value: unknown, keyMatcher?: (key: string) => boolean) {
  const strings: string[] = [];

  function visit(node: unknown, parentKey?: string) {
    if (typeof node === 'string' || typeof node === 'number') {
      const normalized = String(node).trim();
      if (normalized && (!keyMatcher || (parentKey && keyMatcher(parentKey)))) {
        strings.push(normalized);
      }
      return;
    }

    if (!node || typeof node !== 'object') {
      return;
    }

    if (Array.isArray(node)) {
      for (const item of node) {
        visit(item, parentKey);
      }
      return;
    }

    for (const [key, child] of Object.entries(
      node as Record<string, unknown>
    )) {
      visit(child, key);
    }
  }

  visit(value);
  return Array.from(new Set(strings));
}

function collectDetailValues(values: unknown[], keys: Set<string>) {
  return Array.from(
    new Set(
      values.flatMap((value) =>
        collectStrings(value, (key) => keys.has(key)).map((item) => item.trim())
      )
    )
  ).filter(Boolean);
}

function buildSearchText(tokens: unknown[]) {
  return tokens
    .flatMap((token) => {
      if (token == null) {
        return [];
      }
      if (Array.isArray(token)) {
        return token;
      }
      return [token];
    })
    .map((token) => String(token).trim().toLowerCase())
    .filter(Boolean)
    .join(' ');
}

export function getSupplierNameFromMetadata(
  metadata: Record<string, unknown> | null | undefined
) {
  if (!metadata) {
    return '';
  }

  for (const key of SUPPLIER_METADATA_KEYS) {
    const value = getTrimmedString(metadata[key]);
    if (value) {
      return value;
    }
  }

  return '';
}

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
