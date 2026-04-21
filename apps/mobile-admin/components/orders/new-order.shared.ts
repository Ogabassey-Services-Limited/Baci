import {
  BRAND_COLORS,
  ORDER_SOURCE_CONFIG,
  type OrderSource,
} from '@baci/shared';
import type { Ionicons } from '@expo/vector-icons';
import type { CountryCode } from 'react-native-country-picker-modal';

export const MODAL_FLATLIST_PROPS = {
  initialNumToRender: 20,
  maxToRenderPerBatch: 20,
  removeClippedSubviews: false,
  windowSize: 10,
} as const;

export const DEFAULT_COUNTRY_CODE: CountryCode = 'NG';

interface CustomerDisplayFields {
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
}

function getTrimmedValue(value?: string | null) {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : null;
}

export function getCustomerDisplayName(customer: CustomerDisplayFields): string {
  const fullName = [customer.first_name, customer.last_name]
    .map((value) => getTrimmedValue(value))
    .filter((value): value is string => Boolean(value))
    .join(' ');

  if (fullName) {
    return fullName;
  }

  const email = getTrimmedValue(customer.email);
  if (email) {
    return email.split('@')[0]?.trim() || email;
  }

  return getTrimmedValue(customer.phone) || 'Unknown';
}

export function getCustomerDisplayContact(
  customer: CustomerDisplayFields
): string {
  return (
    getTrimmedValue(customer.phone) ||
    getTrimmedValue(customer.email) ||
    'No contact info'
  );
}

export function getCustomerDisplayInitial(
  customer: CustomerDisplayFields
): string {
  return (
    getTrimmedValue(customer.first_name)?.[0] ||
    getTrimmedValue(customer.email)?.[0] ||
    getTrimmedValue(customer.phone)?.[0] ||
    '?'
  ).toUpperCase();
}

export function formatPriceInput(value: string | undefined): string {
  if (!value) return '';

  const normalizedValue = value.replace(/,/g, '');
  const [rawInteger = '', ...rawDecimals] = normalizedValue.split('.');
  const safeInteger = rawInteger || (rawDecimals.length > 0 ? '0' : '');
  const formattedInteger =
    safeInteger && !Number.isNaN(Number(safeInteger))
      ? Number(safeInteger).toLocaleString('en-US')
      : safeInteger;
  const decimalValue = rawDecimals.join('');

  return decimalValue ? `${formattedInteger}.${decimalValue}` : formattedInteger;
}

export function formatVatPercentage(vatRate: number): string {
  const percentage = vatRate * 100;
  return Number.isInteger(percentage)
    ? percentage.toFixed(0)
    : percentage.toFixed(1);
}

export const CHANNELS: {
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  id: OrderSource;
  label: string;
}[] = [
  {
    id: 'physical',
    label: 'Physical sales',
    icon: 'storefront',
    color: ORDER_SOURCE_CONFIG?.physical?.colorKey ?? 'primary',
  },
  {
    id: 'instagram',
    label: 'Instagram',
    icon: 'logo-instagram',
    color: BRAND_COLORS?.instagram ?? '#E4405F',
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    icon: 'logo-whatsapp',
    color: BRAND_COLORS?.whatsapp ?? '#25D366',
  },
  {
    id: 'facebook',
    label: 'Facebook',
    icon: 'logo-facebook',
    color: BRAND_COLORS?.facebook ?? '#1877F2',
  },
  {
    id: 'tiktok',
    label: 'Tiktok',
    icon: 'logo-tiktok',
    color: BRAND_COLORS?.tiktok ?? '#000000',
  },
  {
    id: 'jumia',
    label: 'Jumia',
    icon: 'cart',
    color: BRAND_COLORS?.jumia ?? '#F68B1E',
  },
  {
    id: 'jiji',
    label: 'Jiji',
    icon: 'pricetag',
    color: BRAND_COLORS?.jiji ?? '#3DB83A',
  },
  {
    id: 'konga',
    label: 'Konga',
    icon: 'bag',
    color: BRAND_COLORS?.konga ?? '#ED017F',
  },
];

/**
 * Sanitizes a raw text input into a valid decimal string suitable for price /
 * amount fields. Strips all characters except digits and the first decimal
 * point. Returns an empty string when the result would be meaningless.
 */
export function parseDecimalInput(text: string): string {
  // Keep only digits and dots
  const stripped = text.replace(/[^0-9.]/g, '');
  // Allow at most one decimal point
  const parts = stripped.split('.');
  if (parts.length <= 1) {
    return stripped;
  }
  // Reconstruct: first segment + '.' + remaining segments concatenated
  return `${parts[0]}.${parts.slice(1).join('')}`;
}

export const PAYMENT_METHODS = [
  { id: 'transfer', label: 'Transfer', icon: 'card-outline' },
  { id: 'cash', label: 'Cash', icon: 'cash-outline' },
  { id: 'pos', label: 'POS', icon: 'calculator-outline' },
];
