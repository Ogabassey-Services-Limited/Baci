import { type Href, router } from 'expo-router';
import { sanitizeResumableWalletReturnTo } from '@/lib/resumable-wallet-return-to';

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
      // purchase). A generic "is internal path" check is NOT enough here: an
      // internal redirector such as `/auth/callback?returnTo=//evil.com` is an
      // internal path yet forwards control to an attacker-chosen destination.
      // So this uses the strict resumable-destination allowlist (checkout,
      // imei-check, utilities/<type>) shared with the server persist path. Land
      // on the wallet FIRST (the credit context) and resume the destination on
      // top — back returns to the wallet, matching the "Return to your
      // purchase" promise.
      const returnTo = sanitizeResumableWalletReturnTo(params?.returnTo);
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
