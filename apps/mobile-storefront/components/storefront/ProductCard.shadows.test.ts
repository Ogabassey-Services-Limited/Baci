import { withAlpha } from '@/constants/Colors';
import { getProductCardShadowStyles } from './ProductCard.shadows';

describe('getProductCardShadowStyles', () => {
  it('returns CSS box shadows on web', () => {
    const gridShadowColor = '#000000';
    const floatingCartShadowColor = '#111827';

    expect(
      getProductCardShadowStyles(
        'web',
        gridShadowColor,
        floatingCartShadowColor
      )
    ).toEqual({
      gridContainer: {
        boxShadow: `0px 2px 4px ${withAlpha(gridShadowColor, 0.05)}`,
      },
      floatingCartBtn: {
        boxShadow: `0px 2px 4px ${withAlpha(floatingCartShadowColor, 0.1)}`,
      },
    });
  });

  it('keeps the iOS soft shadow but minimizes Android elevation', () => {
    const native = getProductCardShadowStyles('native', '#000000', '#111827');

    // iOS soft-shadow props preserved (cached, cheap during scroll)...
    expect(native.gridContainer).toMatchObject({
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
    });
    expect(native.floatingCartBtn).toMatchObject({
      shadowColor: '#111827',
      shadowOpacity: 0.1,
    });

    // ...while Android elevation (re-derived per composite) is minimized.
    expect(native.gridContainer.elevation).toBe(0);
    expect(native.floatingCartBtn.elevation).toBe(1);
  });
});
