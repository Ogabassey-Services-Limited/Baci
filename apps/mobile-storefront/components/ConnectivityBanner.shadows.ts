import { palette, withAlpha } from '@/constants/Colors';

type ConnectivityBannerShadowPlatform = 'web' | 'ios' | 'android';

export function getConnectivityBannerShadowStyle(
  platform: ConnectivityBannerShadowPlatform
) {
  if (platform === 'web') {
    return {
      boxShadow: `0px 2px 4px ${withAlpha(palette.black, 0.1)}`,
    } as const;
  }

  if (platform === 'ios') {
    return {
      shadowColor: palette.black,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    } as const;
  }

  return { elevation: 4 } as const;
}
