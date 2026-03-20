import { getAllBusinessTypes } from '@/config/business-types';
import type {
  BusinessTypeBreakdown,
  OrderStatusBreakdown,
  PaymentMethodBreakdown,
} from '@/types/analytics';

export interface AnalyticsOrderRow {
  payment_method: string | null;
  payment_status: string | null;
  shipping_status: string | null;
  total: number | string | null;
}

const BUSINESS_TYPE_LABELS = new Map(
  getAllBusinessTypes().map((businessType) => [
    businessType.id,
    businessType.label,
  ])
);

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  bnpl_pending: 'BNPL Pending',
  cancelled: 'Cancelled',
  failed: 'Failed',
  paid: 'Paid',
  partially_paid: 'Partially Paid',
  pending: 'Pending',
  refunded: 'Refunded',
  unpaid: 'Unpaid',
  unknown: 'Unknown',
};

const SHIPPING_STATUS_LABELS: Record<string, string> = {
  cancelled: 'Cancelled',
  delivered: 'Delivered',
  fulfilled: 'Fulfilled',
  pending: 'Pending',
  processing: 'Processing',
  shipped: 'Shipped',
  unknown: 'Unknown',
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  bank_transfer: 'Bank Transfer',
  bnpl: 'Buy Now, Pay Later',
  card: 'Card',
  cash: 'Cash',
  cash_on_delivery: 'Cash on Delivery',
  mobile_money: 'Mobile Money',
  pos: 'POS',
  unknown: 'Unknown',
  ussd: 'USSD',
  wallet: 'Wallet',
};

const PAYMENT_STATUS_ORDER = [
  'paid',
  'pending',
  'bnpl_pending',
  'partially_paid',
  'unpaid',
  'failed',
  'refunded',
  'cancelled',
  'unknown',
];

const SHIPPING_STATUS_ORDER = [
  'pending',
  'processing',
  'fulfilled',
  'shipped',
  'delivered',
  'cancelled',
  'unknown',
];

function parseAmount(value: number | string | null): number {
  if (value === null) {
    return 0;
  }

  const amount = typeof value === 'string' ? Number.parseFloat(value) : value;
  return Number.isFinite(amount) ? amount : 0;
}

function toTitleCase(value: string): string {
  return value
    .split(/[_-]+/)
    .filter(Boolean)
    .map((segment) =>
      segment.toLowerCase() === 'bnpl'
        ? 'BNPL'
        : segment.charAt(0).toUpperCase() + segment.slice(1)
    )
    .join(' ');
}

function getStatusSortIndex(status: string, orderedStatuses: string[]): number {
  const index = orderedStatuses.indexOf(status);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function getShare(count: number, total: number): number {
  return total > 0 ? (count / total) * 100 : 0;
}

export function buildBusinessTypeBreakdowns(
  businessTypes: Array<string | null | undefined>,
  totalMerchants: number
): BusinessTypeBreakdown[] {
  const configuredCounts = new Map<string, number>();
  const invalidValues = new Set<string>();
  let invalidCount = 0;
  let unspecifiedCount = 0;

  for (const businessType of businessTypes) {
    const rawBusinessType = businessType?.trim();
    const normalizedValue = rawBusinessType?.toLowerCase();

    if (!normalizedValue) {
      unspecifiedCount += 1;
      continue;
    }

    const configuredLabel = BUSINESS_TYPE_LABELS.get(normalizedValue);
    if (configuredLabel) {
      configuredCounts.set(
        normalizedValue,
        (configuredCounts.get(normalizedValue) ?? 0) + 1
      );
      continue;
    }

    invalidCount += 1;
    invalidValues.add(rawBusinessType ?? normalizedValue);
  }

  const configuredBreakdowns = Array.from(configuredCounts.entries()).flatMap(
    ([businessType, merchants]) => {
      const label = BUSINESS_TYPE_LABELS.get(businessType);

      if (!label) {
        return [];
      }

      return [
        {
          businessType,
          classification: 'configured' as const,
          label,
          merchants,
          rawValues: [],
          shareOfMerchants: getShare(merchants, totalMerchants),
        },
      ];
    }
  );

  const specialBreakdowns: BusinessTypeBreakdown[] = [];

  if (unspecifiedCount > 0) {
    specialBreakdowns.push({
      businessType: 'unspecified',
      classification: 'unspecified',
      label: 'Unspecified',
      merchants: unspecifiedCount,
      rawValues: [],
      shareOfMerchants: getShare(unspecifiedCount, totalMerchants),
    });
  }

  if (invalidCount > 0) {
    specialBreakdowns.push({
      businessType: 'invalid',
      classification: 'invalid',
      label: 'Invalid / Legacy Values',
      merchants: invalidCount,
      rawValues: Array.from(invalidValues).sort((left, right) =>
        left.localeCompare(right)
      ),
      shareOfMerchants: getShare(invalidCount, totalMerchants),
    });
  }

  return [...configuredBreakdowns, ...specialBreakdowns].sort((left, right) => {
    if (right.merchants !== left.merchants) {
      return right.merchants - left.merchants;
    }

    if (left.classification !== right.classification) {
      return left.classification.localeCompare(right.classification);
    }

    return left.label.localeCompare(right.label);
  });
}

export function buildOrderStatusBreakdowns(
  orders: AnalyticsOrderRow[],
  dimension: 'payment' | 'shipping'
): OrderStatusBreakdown[] {
  const totalOrders = orders.length;
  const totalAmount = orders.reduce(
    (sum, order) => sum + parseAmount(order.total),
    0
  );
  const orderedStatuses =
    dimension === 'payment' ? PAYMENT_STATUS_ORDER : SHIPPING_STATUS_ORDER;
  const labelMap =
    dimension === 'payment' ? PAYMENT_STATUS_LABELS : SHIPPING_STATUS_LABELS;
  const statusMap = new Map<
    string,
    { amount: number; label: string; orders: number; status: string }
  >();

  for (const order of orders) {
    const rawStatus =
      dimension === 'payment' ? order.payment_status : order.shipping_status;
    const status = rawStatus?.trim().toLowerCase() || 'unknown';
    const current = statusMap.get(status) ?? {
      amount: 0,
      label: labelMap[status] ?? toTitleCase(status),
      orders: 0,
      status,
    };
    current.orders += 1;
    current.amount += parseAmount(order.total);
    statusMap.set(status, current);
  }

  return Array.from(statusMap.values())
    .sort((left, right) => {
      const indexDiff =
        getStatusSortIndex(left.status, orderedStatuses) -
        getStatusSortIndex(right.status, orderedStatuses);

      if (indexDiff !== 0) {
        return indexDiff;
      }

      if (right.orders !== left.orders) {
        return right.orders - left.orders;
      }

      return left.label.localeCompare(right.label);
    })
    .map((status) => ({
      ...status,
      shareOfAmount: getShare(status.amount, totalAmount),
      shareOfOrders: getShare(status.orders, totalOrders),
    }));
}

export function buildPaymentMethodBreakdowns(
  orders: AnalyticsOrderRow[]
): PaymentMethodBreakdown[] {
  const paidOrders = orders.filter(
    (order) => order.payment_status?.trim().toLowerCase() === 'paid'
  );
  const totalPaidAmount = paidOrders.reduce(
    (sum, order) => sum + parseAmount(order.total),
    0
  );
  const methodMap = new Map<
    string,
    { amount: number; label: string; method: string; orders: number }
  >();

  for (const order of paidOrders) {
    const method = order.payment_method?.trim().toLowerCase() || 'unknown';
    const current = methodMap.get(method) ?? {
      amount: 0,
      label: PAYMENT_METHOD_LABELS[method] ?? toTitleCase(method),
      method,
      orders: 0,
    };
    current.orders += 1;
    current.amount += parseAmount(order.total);
    methodMap.set(method, current);
  }

  const totalPaidOrders = paidOrders.length;

  return Array.from(methodMap.values())
    .sort((left, right) => {
      if (right.amount !== left.amount) {
        return right.amount - left.amount;
      }

      if (right.orders !== left.orders) {
        return right.orders - left.orders;
      }

      return left.label.localeCompare(right.label);
    })
    .map((method) => ({
      ...method,
      shareOfPaidAmount: getShare(method.amount, totalPaidAmount),
      shareOfPaidOrders: getShare(method.orders, totalPaidOrders),
    }));
}
