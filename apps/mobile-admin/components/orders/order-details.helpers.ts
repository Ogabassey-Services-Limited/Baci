import { SHIPPING_STATUS_CONFIG, type ShippingStatus } from '@baci/shared';
import type { ThemeColors } from '@/constants/theme';
import type { OrderSourceInfo } from './order-details.types';

export function normalizeOrderDetailsShippingStatus(
  status: string | null | undefined
): ShippingStatus {
  if (status === 'fulfilled') {
    return 'delivered';
  }

  return status && status in SHIPPING_STATUS_CONFIG
    ? (status as ShippingStatus)
    : 'pending';
}

export function getOrderStatusColor(
  colors: ThemeColors,
  key: string | undefined
) {
  const colorMap: Record<string, string> = {
    cancelled: colors.cancelled,
    delivered: colors.delivered,
    paid: colors.success,
    pending: colors.pending,
    processing: colors.processing,
    refunded: colors.textMuted,
    returned: colors.returned || colors.textMuted,
    shipped: colors.shipped,
    unpaid: colors.error,
  };

  return colorMap[key || ''] || colors.textSecondary;
}

export function getOrderCurrencySymbol(
  currencyCode: string | null | undefined
) {
  const symbols: Record<string, string> = {
    EUR: '€',
    GBP: '£',
    NGN: '₦',
    USD: '$',
  };

  return symbols[currencyCode || 'NGN'] || '₦';
}

export function getOrderSourceInfo(
  colors: ThemeColors,
  source: string | null | undefined
): OrderSourceInfo {
  const normalizedSource = (source || '').toLowerCase().trim();

  if (normalizedSource === 'instagram') {
    return { color: '#C13584', label: 'Instagram', name: 'logo-instagram' };
  }
  if (normalizedSource === 'whatsapp') {
    return { color: '#25D366', label: 'WhatsApp', name: 'logo-whatsapp' };
  }
  if (normalizedSource === 'facebook') {
    return { color: '#1877F2', label: 'Facebook', name: 'logo-facebook' };
  }
  if (normalizedSource === 'tiktok') {
    return { color: '#000000', label: 'TikTok', name: 'logo-tiktok' };
  }
  if (normalizedSource === 'mobile_app') {
    return {
      color: colors.primary,
      label: 'Mobile App',
      name: 'phone-portrait-outline',
    };
  }
  if (normalizedSource === 'physical') {
    return { color: colors.gold, label: 'Store', name: 'storefront-outline' };
  }
  if (normalizedSource === 'staff_entry') {
    return {
      color: colors.textSecondary,
      label: 'Staff Entry',
      name: 'person-outline',
    };
  }
  if (
    normalizedSource === 'online_store' ||
    normalizedSource === 'website' ||
    normalizedSource === 'storefront'
  ) {
    return {
      color: colors.textSecondary,
      label: 'Website',
      name: 'globe-outline',
    };
  }

  return {
    color: colors.textSecondary,
    label:
      normalizedSource.charAt(0).toUpperCase() + normalizedSource.slice(1) ||
      'Order',
    name: 'pricetag-outline',
  };
}

export function formatOrderAddress(
  address:
    | {
        address?: string | null;
        city?: string | null;
        state?: string | null;
      }
    | string
    | null
    | undefined
) {
  if (!address) {
    return 'No shipping address provided';
  }

  if (typeof address === 'string') {
    return address;
  }

  const result = [address.address, address.city, address.state]
    .filter((part): part is string => Boolean(part))
    .join(', ');
  return result || 'No shipping address provided';
}
