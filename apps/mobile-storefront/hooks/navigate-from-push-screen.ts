import { type Href, router } from 'expo-router';
import { sanitizeWalletReturnTo } from '@/lib/sanitize-wallet-return-to';

// Module-scope routing dispatcher for notification taps. Kept out of the hook
// body so the useEffectEvent wrapper stays thin; behavior is unchanged.
export function navigateFromPushScreen(
  screen: string,
  params?: Record<string, string>
) {
  switch (screen) {
    case 'order-details':
      // Missing id would push to `/orders/undefined`; fall back to the list.
      if (params?.id) {
        router.push(`/orders/${params.id}`);
      } else {
        router.push('/orders');
      }
      break;
    case 'orders':
      router.push('/orders');
      break;
    case 'repairs':
      router.push('/repairs');
      break;
    case 'product':
      if (params?.slug) {
        router.push(`/product/${params.slug}`);
      } else {
        router.push('/');
      }
      break;
    case 'category':
      if (params?.slug) {
        router.push(`/category/${params.slug}` as Href);
      } else {
        router.push('/');
      }
      break;
    case 'wallet': {
      if (params?.action === 'savings') {
        router.push({
          pathname: '/wallet',
          params: { action: 'savings' },
        });
        break;
      }
      // Wallet-credited taps may carry an onward destination (the interrupted
      // purchase). Sanitize it here so a malicious returnTo can never redirect
      // the tap off-app, then land on the wallet FIRST (the credit context)
      // and immediately resume the destination on top — back returns to the
      // wallet, matching the "Return to your purchase" promise.
      const returnTo = sanitizeWalletReturnTo(params?.returnTo);
      router.push('/wallet');
      if (returnTo) {
        router.push(returnTo);
      }
      break;
    }
    case 'utility-history':
      router.push(`/utilities/history?type=${params?.type ?? 'power'}` as Href);
      break;
    case 'unlock-orders':
      router.push('/unlock-orders');
      break;
    default:
      router.push('/');
  }
}
