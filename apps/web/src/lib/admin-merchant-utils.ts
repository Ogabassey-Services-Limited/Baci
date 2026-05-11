import {
  ADMIN_DATE_FORMAT_OPTIONS,
  ADMIN_DATE_LOCALE,
  ADMIN_NO_DATE_LABEL,
} from '@/config/admin-merchants';
import type { AdminMerchantSurface } from '@/types/admin-merchant-users';

export const ADMIN_MERCHANT_SURFACES = {
  ADMIN_APP: 'admin_app',
  STOREFRONT_APP: 'storefront_app',
  WEB: 'web',
} as const satisfies Record<string, AdminMerchantSurface>;

export const ADMIN_MERCHANT_SURFACE_LABELS: Record<
  AdminMerchantSurface,
  string
> = {
  [ADMIN_MERCHANT_SURFACES.ADMIN_APP]: 'Admin app',
  [ADMIN_MERCHANT_SURFACES.STOREFRONT_APP]: 'Storefront app',
  [ADMIN_MERCHANT_SURFACES.WEB]: 'Web',
};

export function formatAdminMerchantDate(date: string | null): string {
  if (!date) {
    return ADMIN_NO_DATE_LABEL;
  }

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) {
    return ADMIN_NO_DATE_LABEL;
  }

  return new Intl.DateTimeFormat(
    ADMIN_DATE_LOCALE,
    ADMIN_DATE_FORMAT_OPTIONS
  ).format(parsedDate);
}

export function getAdminMerchantSurfaceVariant(
  surface: AdminMerchantSurface
): 'default' | 'secondary' | 'outline' {
  if (surface === ADMIN_MERCHANT_SURFACES.ADMIN_APP) {
    return 'default';
  }

  if (surface === ADMIN_MERCHANT_SURFACES.STOREFRONT_APP) {
    return 'secondary';
  }

  return 'outline';
}

export function formatAdminMerchantEnumLabel(value: string): string {
  return value
    .replaceAll('_', ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');
}
