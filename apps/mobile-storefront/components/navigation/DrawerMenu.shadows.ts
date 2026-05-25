import { palette, withAlpha } from '@/constants/Colors';

type DrawerMenuShadowPlatform = 'web' | 'native';

export function getDrawerMenuShadowStyles(platform: DrawerMenuShadowPlatform) {
  if (platform === 'web') {
    return {
      authButton: {
        boxShadow: `0px 2px 4px ${withAlpha(palette.black, 0.1)}`,
      },
      drawer: {
        boxShadow: `4px 0px 20px ${withAlpha(palette.black, 0.15)}`,
      },
    } as const;
  }

  return {
    authButton: {
      shadowColor: palette.black,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    drawer: {
      shadowColor: palette.black,
      shadowOffset: { width: 4, height: 0 },
      shadowOpacity: 0.15,
      shadowRadius: 20,
      elevation: 24,
    },
  } as const;
}
