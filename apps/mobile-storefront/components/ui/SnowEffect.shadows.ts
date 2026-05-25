import { palette, withAlpha } from '@/constants/Colors';

type SnowflakeShadowPlatform = 'web' | 'native';

export function getSnowflakeShadowStyle(platform: SnowflakeShadowPlatform) {
  if (platform === 'web') {
    return {
      boxShadow: `0px 0px 2px ${withAlpha(palette.white, 0.5)}`,
    } as const;
  }

  return {
    shadowColor: palette.white,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 2,
  } as const;
}
