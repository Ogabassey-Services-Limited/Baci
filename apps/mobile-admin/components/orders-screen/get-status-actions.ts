import {
  SHIPPING_STATUS_ACTIONS,
  SHIPPING_STATUS_CONFIG,
  type ShippingStatus,
} from '@baci/shared';
import type { IoniconsIconName } from '@react-native-vector-icons/ionicons';
import { getColorFromKey } from './get-color-from-key';
import type { StatusAction, ThemeColors } from './types';

export function getStatusActions(
  colors: ThemeColors,
  currentStatus: ShippingStatus
): StatusAction[] {
  const actions = SHIPPING_STATUS_ACTIONS[currentStatus] ?? [];

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
