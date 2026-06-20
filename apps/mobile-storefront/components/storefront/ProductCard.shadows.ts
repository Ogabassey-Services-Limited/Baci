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

  // iOS keeps the soft shadow (rasterized once, cheap to re-blit while
  // scrolling). Android `elevation` is re-derived per composite and is the main
  // per-card scroll cost on low-end devices, so it's minimized here — the card
  // already has a hairline border for separation. These are conservative
  // defaults; tune on a mid/low-end Android device.
  return {
    gridContainer: {
      shadowColor: gridShadowColor,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 0,
    },
    floatingCartBtn: {
      shadowColor: floatingCartShadowColor,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 1,
    },
  } as const;
}
