export type TabBarShadowPlatform = 'web' | 'native';

export function getTabBarShadowStyle(platform: TabBarShadowPlatform) {
  if (platform === 'web') {
    return {
      boxShadow: 'none',
    } as const;
  }

  return {
    elevation: 0,
    shadowOpacity: 0,
  } as const;
}
