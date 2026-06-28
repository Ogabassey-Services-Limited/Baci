import { Platform } from 'react-native';
import { BRAND, palette } from '@/constants/Colors';
import { getFilterBarShadowStyles } from './FilterBar.shadows';
import { styles } from './FilterBar.styles';

describe('FilterBar styles', () => {
  it('uses color tokens for active category and brand controls', () => {
    expect(styles.catPillActive).toMatchObject({
      backgroundColor: BRAND.primary,
      borderColor: BRAND.primary,
    });
    expect(styles.brandChipActive).toMatchObject({
      backgroundColor: palette.red[500],
      borderColor: palette.red[500],
    });
  });

  it('merges the platform-specific shadow styles into active surfaces', () => {
    const shadows = getFilterBarShadowStyles(
      Platform.OS === 'web' ? 'web' : 'native'
    );

    expect(styles.catPillActive).toMatchObject(shadows.catPillActive);
    expect(styles.popover).toMatchObject(shadows.popover);
    expect(styles.brandChipActive).toMatchObject(shadows.brandChipActive);
    expect(styles.segmentItemActive).toMatchObject(shadows.segmentItemActive);
    expect(styles.viewBtnActive).toMatchObject(shadows.viewBtnActive);
  });

  it('preserves the principal layout style groups', () => {
    expect(Object.keys(styles.container).length).toBeGreaterThan(0);
    expect(Object.keys(styles.categoryList).length).toBeGreaterThan(0);
    expect(Object.keys(styles.toolsContainer).length).toBeGreaterThan(0);
  });
});
