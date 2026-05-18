import type { TransactionReviewOrder } from './transaction-review-types';

function normalizeCostPriceDigits(value: string) {
  let hasDecimal = false;

  return value
    .split('')
    .filter((character) => {
      if (/\d/.test(character)) {
        return true;
      }
      if (character === '.' && !hasDecimal) {
        hasDecimal = true;
        return true;
      }
      return false;
    })
    .join('');
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
  const normalized = normalizeCostPriceDigits(value);

  if (!normalized) {
    return '';
  }

  const [rawIntegerPart, decimalPart] = normalized.split('.');
  const integerPart = rawIntegerPart || '0';
  const formattedInteger = Number(integerPart).toLocaleString('en-US');

  return `${currencySymbol}${formattedInteger}${
    decimalPart == null ? '' : `.${decimalPart}`
  }`;
}

export function parseCostPriceInput(value: string) {
  const normalized = normalizeCostPriceDigits(value);

  if (!normalized) {
    return Number.NaN;
  }

  return Number.parseFloat(normalized);
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
      };
    })
    .filter((order) => order.items.length > 0);
}
