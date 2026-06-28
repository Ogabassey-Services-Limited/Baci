// The admin app is a merchant dashboard with no checkout/payment flows, so the
// storefront's deferred-route set (checkout, bank-transfer, crypto-payment, …)
// does not apply. We only defer the update prompt on routes where an interrupting
// modal would derail an in-progress, hard-to-resume task:
//   - root bootstrap — app/index.tsx is still resolving auth/onboarding redirects.
//   - auth URLs — sign-in/onboarding, where a modal would block authentication.
//   - `/scan` — live barcode/IMEI scanning, where a modal would interrupt the
//     camera capture flow.
//   - purchase flows — subscription and domain-buying screens hand off to
//     external payment sheets that should not be covered by a blocking modal.
//
// Expo Router route groups like `(auth)` and `(admin)` are not URL segments;
// `usePathname()` reports real pathnames such as `/login` and `/scan`.
const DEFERRED_UPDATE_ROUTE_PREFIXES = [
  '/',
  '/complete-profile',
  '/domains/buy',
  '/forgot-password',
  '/login',
  '/onboarding',
  '/register',
  '/scan',
  '/subscribe',
  '/verify',
] as const;

export function shouldDeferMobileUpdatePrompt(
  pathname: string | null | undefined
) {
  if (!pathname) return false;

  return DEFERRED_UPDATE_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}
