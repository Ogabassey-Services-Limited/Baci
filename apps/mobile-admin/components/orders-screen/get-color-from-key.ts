import { BRAND_COLORS } from '@baci/shared';
import type { ThemeColors } from './types';

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
