const DEFERRED_UPDATE_ROUTE_PREFIXES = [
  '/auth',
  '/bank-transfer',
  '/bnpl-checkout',
  '/checkout',
  '/crypto-payment',
  '/payment-gateway',
  '/utilities',
] as const;

export function shouldDeferMobileUpdatePrompt(
  pathname: string | null | undefined
) {
  if (!pathname) return false;

  return DEFERRED_UPDATE_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}
