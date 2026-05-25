import { palette, withAlpha } from '@/constants/Colors';

type AddressShadowPlatform = 'web' | 'native';

export function getAddressShadowStyles(platform: AddressShadowPlatform) {
  if (platform === 'web') {
    return {
      addressCard: {
        boxShadow: `0px 1px 2px ${withAlpha(palette.black, 0.05)}`,
      },
      floatingButton: {
        boxShadow: `0px 4px 8px ${withAlpha(palette.black, 0.2)}`,
      },
    } as const;
  }

  return {
    addressCard: {
      shadowColor: palette.black,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    floatingButton: {
      shadowColor: palette.black,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 4,
    },
  } as const;
}
