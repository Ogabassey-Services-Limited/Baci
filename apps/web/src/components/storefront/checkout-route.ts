import type { Route } from 'next';
import { asRoute } from '@/lib/routes';

interface CheckoutIdentityRoutes {
  checkoutUrl: Route;
  signupUrl: Route;
}

function normalizeCheckoutUrl(checkoutUrl: string): string {
  const trimmedCheckoutUrl = checkoutUrl.trim();

  if (!trimmedCheckoutUrl) {
    return '/checkout';
  }

  if (
    trimmedCheckoutUrl.startsWith('//') ||
    /^[a-zA-Z][\w+.-]*:\/\//.test(trimmedCheckoutUrl)
  ) {
    return '/checkout';
  }

  const normalizedPath = trimmedCheckoutUrl.replace(/^\/+/, '');

  return normalizedPath ? `/${normalizedPath}` : '/checkout';
}

export function buildCheckoutIdentityRoutes(
  checkoutUrl: string
): CheckoutIdentityRoutes {
  const normalizedCheckoutUrl = normalizeCheckoutUrl(checkoutUrl);

  return {
    checkoutUrl: asRoute(normalizedCheckoutUrl),
    signupUrl: asRoute(
      `/signup?redirect=${encodeURIComponent(normalizedCheckoutUrl)}`
    ),
  };
}
