import { describe, expect, it } from 'vitest';
import type { ThemeColors } from '@/constants/theme';
import {
  badgeTextStyle,
  inventoryStatuses,
  selectedBadgeStyle,
} from './VariantInventoryUnitCard.helpers';

const colors = { primary: '#3366ff', text: '#111111' } as ThemeColors;

describe('VariantInventoryUnitCard helpers', () => {
  it('lists every inventory unit status exactly once', () => {
    expect(inventoryStatuses).toEqual([
      'available',
      'reserved',
      'sold',
      'returned',
      'defective',
    ]);
    expect(new Set(inventoryStatuses).size).toBe(inventoryStatuses.length);
  });

  it('builds the selected badge style from the primary color', () => {
    const style = selectedBadgeStyle(colors);

    expect(style.borderColor).toBe('#3366ff');
    expect(style.backgroundColor).toMatch(/^rgba\(/);
  });

  it('colors badge text by selection state', () => {
    expect(badgeTextStyle(colors, true).color).toBe('#3366ff');
    expect(badgeTextStyle(colors, false).color).toBe('#111111');
    expect(badgeTextStyle(colors, true).fontWeight).toBe('600');
  });
});
