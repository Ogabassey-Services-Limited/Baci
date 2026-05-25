type VariantColorSwatchShadowPlatform = 'web' | 'native';

export function getVariantColorSwatchShadowStyle(
  platform: VariantColorSwatchShadowPlatform
) {
  if (platform === 'web') {
    return {
      boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.1)',
    } as const;
  }

  return {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  } as const;
}
