import {
  BRAND_COLORS,
  PAYMENT_STATUS_CONFIG,
  type PaymentStatus,
  SHIPPING_STATUS_ACTIONS,
  SHIPPING_STATUS_CONFIG,
  type ShippingStatus,
} from '@baci/shared';
import type { IoniconsIconName } from '@react-native-vector-icons/ionicons';
import type {
  PaymentStatusConfigGetter,
  ShippingStatusConfigGetter,
  SourceConfigGetter,
  StatusAction,
  ThemeColors,
} from './types';

export function getColorFromKey(colors: ThemeColors, colorKey: string) {
  const colorMap: Record<string, string> = {
    pending: colors.pending,
    processing: colors.processing,
    shipped: colors.shipped,
    delivered: colors.delivered,
    cancelled: colors.cancelled,
    returned: colors.returned || colors.textMuted,
    success: colors.success,
    error: colors.error,
    warning: colors.warning,
    info: colors.info || colors.primary,
    textMuted: colors.textMuted,
    primary: colors.primary,
    gold: colors.gold,
    whatsapp: BRAND_COLORS.whatsapp,
    instagram: BRAND_COLORS.instagram,
  };

  return colorMap[colorKey] ?? colors.textMuted;
}

export function getStatusActions(
  colors: ThemeColors,
  currentStatus: ShippingStatus
): StatusAction[] {
  const targetStatus = (
    (currentStatus as string) === 'fulfilled' ? 'pending' : currentStatus
  ) as ShippingStatus;
  const actions = SHIPPING_STATUS_ACTIONS[targetStatus] ?? [];

  return actions.map((action) => ({
    status: action.nextStatus,
    label: action.label,
    icon: action.icon as IoniconsIconName,
    color: getColorFromKey(
      colors,
      SHIPPING_STATUS_CONFIG[action.nextStatus]?.colorKey ?? 'textMuted'
    ),
  }));
}

export function createShippingStatusConfigGetter(
  colors: ThemeColors
): ShippingStatusConfigGetter {
  return (status: ShippingStatus) => {
    const config =
      SHIPPING_STATUS_CONFIG[status] ?? SHIPPING_STATUS_CONFIG.pending;

    return {
      color: getColorFromKey(colors, config.colorKey),
      label: config.label,
    };
  };
}

export function createPaymentStatusConfigGetter(
  colors: ThemeColors
): PaymentStatusConfigGetter {
  return (status: PaymentStatus) => {
    const config =
      PAYMENT_STATUS_CONFIG[status] ?? PAYMENT_STATUS_CONFIG.pending;

    return {
      color: getColorFromKey(colors, config.colorKey),
      label: config.label,
    };
  };
}

export function createSourceConfigGetter(
  colors: ThemeColors
): SourceConfigGetter {
  return (source: string | null) => {
    if (!source) {
      return {
        icon: 'globe-outline' as const,
        color: colors.textSecondary,
        label: 'Website',
      };
    }

    const normalizedSource = source.toLowerCase().trim();

    switch (normalizedSource) {
      case 'instagram':
        return {
          icon: 'logo-instagram' as const,
          color: '#C13584',
          label: 'Instagram',
        };
      case 'whatsapp':
        return {
          icon: 'logo-whatsapp' as const,
          color: '#25D366',
          label: 'WhatsApp',
        };
      case 'facebook':
        return {
          icon: 'logo-facebook' as const,
          color: '#1877F2',
          label: 'Facebook',
        };
      case 'twitter':
      case 'x':
        return {
          icon: 'logo-twitter' as const,
          color: '#1DA1F2',
          label: 'Twitter',
        };
      case 'tiktok':
        return {
          icon: 'logo-tiktok' as const,
          color: '#000000',
          label: 'TikTok',
        };
      case 'snapchat':
        return {
          icon: 'logo-snapchat' as const,
          color: '#FFFC00',
          label: 'Snapchat',
        };
      case 'youtube':
        return {
          icon: 'logo-youtube' as const,
          color: '#FF0000',
          label: 'YouTube',
        };
      case 'pinterest':
        return {
          icon: 'logo-pinterest' as const,
          color: '#BD081C',
          label: 'Pinterest',
        };
      case 'linkedin':
        return {
          icon: 'logo-linkedin' as const,
          color: '#0A66C2',
          label: 'LinkedIn',
        };
      case 'telegram':
        return {
          icon: 'paper-plane' as const,
          color: '#0088CC',
          label: 'Telegram',
        };
      case 'amazon':
        return {
          icon: 'logo-amazon' as const,
          color: '#FF9900',
          label: 'Amazon',
        };
      case 'jumia':
        return { icon: 'cart' as const, color: '#FF9900', label: 'Jumia' };
      case 'konga':
        return { icon: 'cart' as const, color: '#ED017F', label: 'Konga' };
      case 'jiji':
        return { icon: 'cart' as const, color: '#3DBE29', label: 'Jiji' };
      case 'mobile_app':
        return {
          icon: 'phone-portrait-outline' as const,
          color: colors.primary,
          label: 'Mobile App',
        };
      case 'online_store':
      case 'website':
      case 'storefront':
        return {
          icon: 'globe-outline' as const,
          color: colors.info || colors.textSecondary,
          label: 'Website',
        };
      case 'pos':
        return {
          icon: 'calculator-outline' as const,
          color: colors.success,
          label: 'POS',
        };
      case 'physical':
        return {
          icon: 'storefront-outline' as const,
          color: colors.gold,
          label: 'Store',
        };
      case 'staff_entry':
        return {
          icon: 'person-outline' as const,
          color: colors.textSecondary,
          label: 'Staff',
        };
      default:
        return {
          icon: 'pricetag-outline' as const,
          color: colors.textSecondary,
          label: source.charAt(0).toUpperCase() + source.slice(1),
        };
    }
  };
}
