export type CustomerOrderStatusKey =
  | 'placed'
  | 'confirmed'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'returned';

export type CustomerOrderProgressState =
  | 'completed'
  | 'current'
  | 'upcoming';

export type CustomerOrderStatusIconName =
  | 'receipt-outline'
  | 'checkmark-circle-outline'
  | 'car-outline'
  | 'checkmark-done-outline'
  | 'close-circle-outline'
  | 'return-down-back-outline';

export interface CustomerOrderStatusMeta {
  key: CustomerOrderStatusKey;
  label: string;
  shortLabel: string;
  description: string;
  icon: CustomerOrderStatusIconName;
}

export interface CustomerOrderStatusPalette {
  accent: string;
  surface: string;
  border: string;
}

export const CUSTOMER_ORDER_PROGRESS_STEPS = [
  {
    key: 'placed',
    label: 'Placed',
    icon: 'receipt-outline',
  },
  {
    key: 'confirmed',
    label: 'Confirmed',
    icon: 'checkmark-circle-outline',
  },
  {
    key: 'shipped',
    label: 'Shipped',
    icon: 'car-outline',
  },
  {
    key: 'delivered',
    label: 'Delivered',
    icon: 'checkmark-done-outline',
  },
] as const;

const CUSTOMER_ORDER_STATUS_META: Record<
  CustomerOrderStatusKey,
  CustomerOrderStatusMeta
> = {
  placed: {
    key: 'placed',
    label: 'Order placed',
    shortLabel: 'Placed',
    description: 'We have received your order.',
    icon: 'receipt-outline',
  },
  confirmed: {
    key: 'confirmed',
    label: 'Order confirmed',
    shortLabel: 'Confirmed',
    description: 'The merchant has confirmed your order and is getting it ready.',
    icon: 'checkmark-circle-outline',
  },
  shipped: {
    key: 'shipped',
    label: 'Shipped',
    shortLabel: 'Shipped',
    description: 'Your order has left the merchant and is heading to you.',
    icon: 'car-outline',
  },
  delivered: {
    key: 'delivered',
    label: 'Delivered',
    shortLabel: 'Delivered',
    description: 'Your order has been delivered successfully.',
    icon: 'checkmark-done-outline',
  },
  cancelled: {
    key: 'cancelled',
    label: 'Cancelled',
    shortLabel: 'Cancelled',
    description: 'This order has been cancelled.',
    icon: 'close-circle-outline',
  },
  returned: {
    key: 'returned',
    label: 'Returned',
    shortLabel: 'Returned',
    description: 'This order was returned after delivery.',
    icon: 'return-down-back-outline',
  },
};

const CUSTOMER_ORDER_STATUS_PALETTES: Record<
  CustomerOrderStatusKey,
  CustomerOrderStatusPalette
> = {
  placed: {
    accent: '#DC2626',
    surface: 'rgba(220, 38, 38, 0.10)',
    border: 'rgba(220, 38, 38, 0.18)',
  },
  confirmed: {
    accent: '#2563EB',
    surface: 'rgba(37, 99, 235, 0.10)',
    border: 'rgba(37, 99, 235, 0.18)',
  },
  shipped: {
    accent: '#7C3AED',
    surface: 'rgba(124, 58, 237, 0.10)',
    border: 'rgba(124, 58, 237, 0.18)',
  },
  delivered: {
    accent: '#059669',
    surface: 'rgba(5, 150, 105, 0.10)',
    border: 'rgba(5, 150, 105, 0.18)',
  },
  cancelled: {
    accent: '#DC2626',
    surface: 'rgba(220, 38, 38, 0.10)',
    border: 'rgba(220, 38, 38, 0.18)',
  },
  returned: {
    accent: '#6B7280',
    surface: 'rgba(107, 114, 128, 0.12)',
    border: 'rgba(107, 114, 128, 0.18)',
  },
};

export function getCustomerOrderStatusKey(
  status: string | null | undefined
): CustomerOrderStatusKey {
  switch (status) {
    case 'shipped':
    case 'out_for_delivery':
      return 'shipped';
    case 'delivered':
      return 'delivered';
    case 'cancelled':
    case 'refunded':
      return 'cancelled';
    case 'returned':
      return 'returned';
    case 'processing':
    case 'confirmed':
      return 'confirmed';
    case 'pending':
    default:
      return 'placed';
  }
}

export function getCustomerOrderStatusMeta(
  status: string | null | undefined
): CustomerOrderStatusMeta {
  return CUSTOMER_ORDER_STATUS_META[getCustomerOrderStatusKey(status)];
}

export function getCustomerOrderStatusPalette(
  status: string | null | undefined
): CustomerOrderStatusPalette {
  return CUSTOMER_ORDER_STATUS_PALETTES[getCustomerOrderStatusKey(status)];
}

export function getCustomerOrderProgressIndex(
  status: string | null | undefined
): number {
  const key = getCustomerOrderStatusKey(status);

  switch (key) {
    case 'placed':
      return 0;
    case 'confirmed':
      return 1;
    case 'shipped':
      return 2;
    case 'delivered':
      return 3;
    default:
      return -1;
  }
}

export function getCustomerOrderProgressState(
  status: string | null | undefined,
  stepKey: (typeof CUSTOMER_ORDER_PROGRESS_STEPS)[number]['key']
): CustomerOrderProgressState {
  const currentIndex = getCustomerOrderProgressIndex(status);
  const stepIndex = CUSTOMER_ORDER_PROGRESS_STEPS.findIndex(
    (step) => step.key === stepKey
  );

  if (currentIndex < 0) {
    return 'upcoming';
  }
  if (stepIndex < currentIndex) {
    return 'completed';
  }
  if (stepIndex === currentIndex) {
    return 'current';
  }
  return 'upcoming';
}

export function isCustomerOrderClosed(
  status: string | null | undefined
): boolean {
  const key = getCustomerOrderStatusKey(status);
  return key === 'cancelled' || key === 'returned';
}
