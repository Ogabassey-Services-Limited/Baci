import { Platform } from 'react-native';
import { getFilterBarShadowStyles } from './FilterBar.shadows';
import { getFilterBarStyles } from './FilterBar.styles';

// Minimal theme stub covering the tokens the factory reads.
const colors = {
  primary: '#ff0000',
  primaryForeground: '#ffffff',
  primaryLowOpacity: 'rgba(255,0,0,0.1)',
  card: '#111111',
  background: '#000000',
  border: '#333333',
  muted: '#222222',
  mutedForeground: '#888888',
  text: '#fafafa',
  textSecondary: '#bbbbbb',
  placeholder: '#777777',
} as unknown as Parameters<typeof getFilterBarStyles>[0];

const styles = getFilterBarStyles(colors);

describe('FilterBar styles', () => {
  it('uses theme tokens for active category and brand controls', () => {
    expect(styles.catPillActive).toMatchObject({
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    });
    expect(styles.brandChipActive).toMatchObject({
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    });
  });

  it('drives the panel surfaces from the theme instead of hardcoded white', () => {
    expect(styles.container.backgroundColor).toBe(colors.card);
    expect(styles.catPill.backgroundColor).toBe(colors.background);
    expect(styles.popover.backgroundColor).toBe(colors.card);
    expect(styles.priceField.backgroundColor).toBe(colors.muted);
    expect(styles.viewBtnActive.backgroundColor).toBe(colors.card);
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
