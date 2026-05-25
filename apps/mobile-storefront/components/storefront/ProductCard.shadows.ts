import { withAlpha } from '@/constants/Colors';

type ProductCardShadowPlatform = 'web' | 'native';

export function getProductCardShadowStyles(
  platform: ProductCardShadowPlatform,
  gridShadowColor: string,
  floatingCartShadowColor: string
) {
  if (platform === 'web') {
    return {
      gridContainer: {
        boxShadow: `0px 2px 4px ${withAlpha(gridShadowColor, 0.05)}`,
      },
      floatingCartBtn: {
        boxShadow: `0px 2px 4px ${withAlpha(floatingCartShadowColor, 0.1)}`,
      },
    } as const;
  }

  return {
    gridContainer: {
      shadowColor: gridShadowColor,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    floatingCartBtn: {
      shadowColor: floatingCartShadowColor,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
  } as const;
}
