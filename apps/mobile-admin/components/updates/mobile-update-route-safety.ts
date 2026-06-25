// The admin app is a merchant dashboard with no checkout/payment flows, so the
// storefront's deferred-route set (checkout, bank-transfer, crypto-payment, …)
// does not apply. We only defer the update prompt on routes where an interrupting
// modal would derail an in-progress, hard-to-resume task:
//   - `/(auth)` — sign-in/onboarding, where a modal would block authentication.
//   - `/(admin)/scan` — live barcode/IMEI scanning, where a modal would interrupt
//     the camera capture flow.
const DEFERRED_UPDATE_ROUTE_PREFIXES = ['/(auth)', '/(admin)/scan'] as const;

export function shouldDeferMobileUpdatePrompt(
  pathname: string | null | undefined
) {
  if (!pathname) return false;

  return DEFERRED_UPDATE_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}
