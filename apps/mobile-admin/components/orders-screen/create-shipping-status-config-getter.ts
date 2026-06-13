import { SHIPPING_STATUS_CONFIG, type ShippingStatus } from '@baci/shared';
import { getColorFromKey } from './get-color-from-key';
import type { ShippingStatusConfigGetter, ThemeColors } from './types';

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
