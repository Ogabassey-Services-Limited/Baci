import { BRAND } from '@/constants/Colors';
import {
  type CustomerOrderStatusKey,
  getCustomerOrderStatusKey,
} from '@/lib/customer-order-status';

export function formatTrackOrderPrice(
  amount: number,
  currency = 'NGN'
): string {
  return `${currency === 'NGN' ? '\u20A6' : currency} ${amount.toLocaleString()}`;
}

export function formatTrackOrderDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const CUSTOMER_STATUS_BADGES: Record<
  CustomerOrderStatusKey,
  { color: string; bg: string }
> = {
  placed: { color: BRAND.primary, bg: 'rgba(220, 38, 38, 0.10)' },
  confirmed: { color: '#1E40AF', bg: 'rgba(37, 99, 235, 0.10)' },
  shipped: { color: '#1E40AF', bg: 'rgba(37, 99, 235, 0.10)' },
  delivered: { color: '#065F46', bg: 'rgba(5, 150, 105, 0.10)' },
  cancelled: { color: '#991B1B', bg: 'rgba(220, 38, 38, 0.12)' },
  returned: { color: '#4B5563', bg: 'rgba(107, 114, 128, 0.12)' },
};

export function getTrackOrderBadge(status: string) {
  return CUSTOMER_STATUS_BADGES[getCustomerOrderStatusKey(status)];
}

export function isValidTrackingUrl(value: string | null | undefined): boolean {
  return Boolean(value && /^https?:\/\//i.test(value));
}
