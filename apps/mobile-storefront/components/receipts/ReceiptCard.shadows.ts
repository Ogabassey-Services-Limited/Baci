type ReceiptCardShadowPlatform = 'web' | 'native';

export function getReceiptCardShadowStyle(
  platform: ReceiptCardShadowPlatform
) {
  if (platform === 'web') {
    return {
      boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)',
    } as const;
  }

  return {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  } as const;
}
