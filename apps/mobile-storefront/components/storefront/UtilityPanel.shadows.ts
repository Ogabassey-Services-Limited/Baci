import { withAlpha } from '@/constants/Colors';

type UtilityPanelShadowPlatform = 'web' | 'native';

export function getUtilityPanelActiveShadowStyle(
  platform: UtilityPanelShadowPlatform,
  shadowColor: string
) {
  if (platform === 'web') {
    return {
      boxShadow: `0px 2px 4px ${withAlpha(shadowColor, 0.1)}`,
    } as const;
  }

  return {
    shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  } as const;
}
