import type { Href } from 'expo-router';
import type { getNotificationNavigationParams } from '@/services/push-notifications';

interface AdminRouter {
  push: (href: Href) => void;
}

function encodeAdminEntityId(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }

  const trimmedValue = String(value).trim();
  if (!trimmedValue) {
    return null;
  }

  return encodeURIComponent(trimmedValue);
}

export function navigateToNotificationTarget(
  router: AdminRouter,
  navParams: ReturnType<typeof getNotificationNavigationParams>
) {
  if (!navParams) {
    return;
  }

  const entityId = encodeAdminEntityId(navParams.params?.id);

  switch (navParams.screen) {
    case 'order':
      router.push(
        entityId
          ? (`/(admin)/order/${entityId}` as Href)
          : '/(admin)/(tabs)/orders'
      );
      return;
    case 'product':
      router.push(
        entityId
          ? (`/(admin)/product/${entityId}` as Href)
          : '/(admin)/(tabs)/products'
      );
      return;
    case 'orders':
      router.push('/(admin)/(tabs)/orders');
      return;
    case 'products':
      router.push('/(admin)/(tabs)/products');
      return;
    case 'notifications':
      router.push('/(admin)/notifications');
      return;
    case 'negotiations':
      router.push('/(admin)/negotiations');
      return;
    case 'negotiation':
      // No negotiation detail route exists — only the list screen
      // (`/(admin)/negotiations`), which shows the newest request first with
      // inline Accept/Reject. Routing to a `negotiations/[id]` path that has no
      // matching file throws Expo Router's "Unmatched Route" error, so always
      // land on the list. entityId is intentionally unused here.
      router.push('/(admin)/negotiations');
      return;
    default:
      router.push('/(admin)/(tabs)');
  }
}
