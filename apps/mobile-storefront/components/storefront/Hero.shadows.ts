type HeroShadowPlatform = 'web' | 'native';

export function getEliteHeroCardShadowStyle(platform: HeroShadowPlatform) {
  if (platform === 'web') {
    return {
      boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.05)',
    } as const;
  }

  return {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  } as const;
}
