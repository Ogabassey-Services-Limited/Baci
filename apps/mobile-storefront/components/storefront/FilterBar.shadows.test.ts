import { describe, expect, it } from '@jest/globals';
import { BRAND, withAlpha } from '@/constants/Colors';
import { palette } from '@/constants/palette';
import { getFilterBarShadowStyles } from './FilterBar.shadows';

describe('getFilterBarShadowStyles', () => {
  it('uses web box shadows without deprecated native shadow properties', () => {
    const styles = getFilterBarShadowStyles('web');

    expect(styles).toEqual({
      catPillActive: {
        boxShadow: `0px 2px 4px ${withAlpha(BRAND.primary, 0.15)}`,
      },
      popover: {
        boxShadow: `0px 8px 16px ${withAlpha(palette.black, 0.2)}`,
      },
      brandChipActive: {
        boxShadow: `0px 2px 4px ${withAlpha(palette.red[500], 0.1)}`,
      },
      segmentItemActive: {
        boxShadow: `0px 2px 4px ${withAlpha(palette.black, 0.1)}`,
      },
      viewBtnActive: {
        boxShadow: `0px 2px 4px ${withAlpha(palette.black, 0.1)}`,
      },
    });

    for (const style of Object.values(styles)) {
      expect(style).not.toHaveProperty('shadowColor');
      expect(style).not.toHaveProperty('shadowOffset');
      expect(style).not.toHaveProperty('shadowOpacity');
      expect(style).not.toHaveProperty('shadowRadius');
    }
  });

  it('keeps native shadow properties and elevation on mobile', () => {
    expect(getFilterBarShadowStyles('native')).toEqual({
      catPillActive: {
        shadowColor: BRAND.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 3,
      },
      popover: {
        shadowColor: palette.black,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 25,
      },
      brandChipActive: {
        shadowColor: palette.red[500],
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
      },
      segmentItemActive: {
        shadowColor: palette.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
      },
      viewBtnActive: {
        shadowColor: palette.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
      },
    });
  });
});
