import {
  DEFAULT_TRANSLUCENT_PRIMARY,
  type ThemeColors,
} from '@/constants/theme';
import type { VariantInventoryUnit } from '@/hooks/variantInventory';
import { getTranslucentColor } from '@/lib/colors/sanitize-css-color';

export type InventoryStatus = VariantInventoryUnit['status'];

export const inventoryStatuses: readonly InventoryStatus[] = [
  'available',
  'reserved',
  'sold',
  'returned',
  'defective',
];

export function selectedBadgeStyle(colors: ThemeColors) {
  return {
    backgroundColor: getTranslucentColor(
      colors.primary,
      DEFAULT_TRANSLUCENT_PRIMARY,
      0.08
    ),
    borderColor: colors.primary,
  };
}

export function badgeTextStyle(
  colors: ThemeColors,
  isSelected: boolean
): { color: string; fontSize: number; fontWeight: '600' } {
  return {
    color: isSelected ? colors.primary : colors.text,
    fontSize: 11,
    fontWeight: '600',
  };
}
