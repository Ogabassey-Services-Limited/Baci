import { type Href, router } from 'expo-router';

// Module-scope routing dispatcher for notification taps. Kept out of the hook
// body so the useEffectEvent wrapper stays thin; behavior is unchanged.
export function navigateFromPushScreen(
  screen: string,
  params?: Record<string, string>
) {
  switch (screen) {
    case 'order-details':
      router.push(`/orders/${params?.id}`);
      break;
    case 'orders':
      router.push('/orders');
      break;
    case 'product':
      router.push(`/product/${params?.slug}`);
      break;
    case 'category':
      router.push(`/category/${params?.slug}` as Href);
      break;
    case 'wallet':
      if (params?.action === 'savings') {
        router.push({
          pathname: '/wallet',
          params: { action: 'savings' },
        });
      } else {
        router.push('/wallet');
      }
      break;
    case 'utility-history':
      router.push(
        `/utilities/history?type=${params?.type ?? 'power'}` as Href
      );
      break;
    default:
      router.push('/');
  }
}
