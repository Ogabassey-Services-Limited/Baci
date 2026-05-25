import { BRAND, withAlpha } from '@/constants/Colors';

type TypingIndicatorShadowPlatform = 'web' | 'native';

export function getTypingIndicatorDotShadowStyle(
  platform: TypingIndicatorShadowPlatform
) {
  if (platform === 'web') {
    return {
      boxShadow: `0px 1px 4px ${withAlpha(BRAND.primary, 0.12)}`,
    } as const;
  }

  return {
    elevation: 3,
    shadowColor: BRAND.primary,
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  } as const;
}
