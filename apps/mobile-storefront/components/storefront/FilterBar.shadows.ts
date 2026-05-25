import { BRAND, withAlpha } from '@/constants/Colors';
import { palette } from '@/constants/palette';

type FilterBarShadowPlatform = 'web' | 'native';

export function getFilterBarShadowStyles(platform: FilterBarShadowPlatform) {
  if (platform === 'web') {
    return {
      catPillActive: {
        boxShadow: `0px 2px 4px ${withAlpha(BRAND.primary, 0.15)}`,
      },
      popover: {
        boxShadow: '0px 8px 16px rgba(0, 0, 0, 0.2)',
      },
      brandChipActive: {
        boxShadow: `0px 2px 4px ${withAlpha(palette.red[500], 0.1)}`,
      },
      segmentItemActive: {
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
      },
      viewBtnActive: {
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
      },
    } as const;
  }

  return {
    catPillActive: {
      shadowColor: BRAND.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 3,
    },
    popover: {
      shadowColor: '#000',
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
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    viewBtnActive: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
  } as const;
}
