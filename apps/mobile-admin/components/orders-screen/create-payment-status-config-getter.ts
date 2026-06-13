import { PAYMENT_STATUS_CONFIG, type PaymentStatus } from '@baci/shared';
import { getColorFromKey } from './get-color-from-key';
import type { PaymentStatusConfigGetter, ThemeColors } from './types';

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
