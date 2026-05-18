import type { TransactionReviewOrder } from './transaction-review-types';

function countDigits(value: string) {
  return value.replace(/\D/g, '').length;
}

function getCostPriceDecimalIndex(value: string) {
  const dotIndex = value.indexOf('.');

  if (dotIndex !== -1) {
    return dotIndex;
  }

  const commaIndex = value.lastIndexOf(',');

  if (commaIndex === -1) {
    return -1;
  }

  const digitsBeforeComma = countDigits(value.slice(0, commaIndex));
  const digitsAfterComma = countDigits(value.slice(commaIndex + 1));

  if (digitsBeforeComma === 0 && digitsAfterComma > 0) {
    return commaIndex;
  }

  if (digitsBeforeComma > 0 && digitsAfterComma > 0 && digitsAfterComma !== 3) {
    return commaIndex;
  }

  return -1;
}

function normalizeCostPriceParts(value: string) {
  const decimalIndex = getCostPriceDecimalIndex(value);
  const digits = value
    .split('')
    .map((character, index) => {
      if (/\d/.test(character)) {
        return character;
      }
      if (index === decimalIndex) {
        return '.';
      }
      return '';
    })
    .join('');

  return {
    digits,
    isNegative: value.includes('-'),
  };
}

export function formatCostPriceInput(
  amount: number | null | undefined,
  currencySymbol: string
) {
  if (amount == null || Number.isNaN(amount)) {
    return '';
  }

  return formatCostPriceInputText(String(amount), currencySymbol);
}

export function formatCostPriceInputText(
  value: string,
  currencySymbol: string
) {
  const normalized = normalizeCostPriceParts(value);

  if (!normalized.digits) {
    return normalized.isNegative ? '-' : '';
  }

  const [rawIntegerPart, decimalPart] = normalized.digits.split('.');
  const integerPart = rawIntegerPart || '0';
  const formattedInteger = Number(integerPart).toLocaleString('en-US');
  const sign = normalized.isNegative ? '-' : '';

  return `${sign}${currencySymbol}${formattedInteger}${
    decimalPart == null ? '' : `.${decimalPart}`
  }`;
}

export function parseCostPriceInput(value: string) {
  const normalized = normalizeCostPriceParts(value);

  if (!normalized.digits) {
    return Number.NaN;
  }

  const parsed = Number.parseFloat(normalized.digits);

  if (Number.isNaN(parsed)) {
    return Number.NaN;
  }

  return normalized.isNegative ? -parsed : parsed;
}

export function parseDateInputForPicker(dateInput: string) {
  // Keep this as a local date, not UTC, so the picker preserves the user's
  // calendar day; invalid text falls back to today.
  const parsed = dateInput ? new Date(`${dateInput}T00:00:00`) : new Date();

  if (Number.isNaN(parsed.getTime())) {
    return new Date();
  }

  return parsed;
}

export function formatPickerDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function toSentenceCaseSupplierName(value: string) {
  const normalized = value.trim().replace(/\s+/g, ' ').toLowerCase();

  if (!normalized) {
    return '';
  }

  return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
}

export function getSupplierOptionsFromOrders(orders: TransactionReviewOrder[]) {
  return Array.from(
    new Set(
      orders
        .flatMap((order) => order.items.map((item) => item.supplierName))
        .map(toSentenceCaseSupplierName)
        .filter(Boolean)
    )
  ).sort((first, second) => first.localeCompare(second));
}

function getVisibleOrderSearchText(order: TransactionReviewOrder) {
  return [
    order.orderNumber,
    order.customerName,
    order.customerEmail,
    order.customerPhone,
    order.paymentMethod,
    ...order.items.map((item) => item.searchText),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function filterOrdersForTransactionTab(
  orders: TransactionReviewOrder[],
  activeTab: 'missing-costs' | 'paid'
) {
  if (activeTab === 'paid') {
    return orders;
  }

  return orders
    .map((order) => {
      const missingCostItems = order.items.filter(
        (item) => item.costPrice == null
      );

      return {
        ...order,
        estimatedProfit: missingCostItems.reduce(
          (sum, item) => sum + (item.profit ?? 0),
          0
        ),
        items: missingCostItems,
        missingCostCount: missingCostItems.length,
        searchText: getVisibleOrderSearchText({
          ...order,
          items: missingCostItems,
        }),
      };
    })
    .filter((order) => order.items.length > 0);
}
