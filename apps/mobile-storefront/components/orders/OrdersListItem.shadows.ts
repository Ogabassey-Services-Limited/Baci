import { withAlpha } from '@/constants/Colors';

type OrdersListItemShadowPlatform = 'web' | 'native';

export function getOrdersListItemShadowStyle(
  platform: OrdersListItemShadowPlatform,
  shadowColor: string
) {
  if (platform === 'web') {
    return {
      boxShadow: `0px 10px 18px ${withAlpha(shadowColor, 0.08)}`,
    } as const;
  }

  return {
    shadowColor,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  } as const;
}
