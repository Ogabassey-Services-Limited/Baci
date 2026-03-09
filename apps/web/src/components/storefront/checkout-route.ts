import type { Route } from 'next';
import { asRoute } from '@/lib/routes';

interface CheckoutIdentityRoutes {
  checkoutUrl: Route;
  signupUrl: Route;
}

function normalizeCheckoutUrl(checkoutUrl: string): string {
  const trimmedCheckoutUrl = checkoutUrl.trim();

  if (!trimmedCheckoutUrl || trimmedCheckoutUrl.startsWith('//')) {
    return '/checkout';
  }

  return trimmedCheckoutUrl.startsWith('/')
    ? trimmedCheckoutUrl
    : `/${trimmedCheckoutUrl}`;
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
