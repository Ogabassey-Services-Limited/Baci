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

export function formatPriceInput(value: string | undefined): string {
  if (!value) return '';

  const parts = value.split('.');
  const rawInt = parts[0].replace(/,/g, '');
  const formattedInt =
    !Number.isNaN(Number(rawInt)) && rawInt !== ''
      ? Number(rawInt).toLocaleString('en-US')
      : parts[0];

  return parts.length > 1 ? `${formattedInt}.${parts[1]}` : formattedInt;
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
    color: BRAND_COLORS?.whatsapp || '#25D366',
  },
  {
    id: 'facebook',
    label: 'Facebook',
    icon: 'logo-facebook',
    color: BRAND_COLORS?.facebook || '#1877F2',
  },
  {
    id: 'tiktok',
    label: 'Tiktok',
    icon: 'logo-tiktok',
    color: BRAND_COLORS?.tiktok || '#000000',
  },
  {
    id: 'jumia',
    label: 'Jumia',
    icon: 'cart',
    color: BRAND_COLORS?.jumia || '#F68B1E',
  },
  {
    id: 'jiji',
    label: 'Jiji',
    icon: 'pricetag',
    color: BRAND_COLORS?.jiji || '#3DB83A',
  },
  {
    id: 'konga',
    label: 'Konga',
    icon: 'bag',
    color: BRAND_COLORS?.konga || '#ED017F',
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
