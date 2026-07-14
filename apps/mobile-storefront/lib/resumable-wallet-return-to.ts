import { sanitizeResumableWalletReturnTo as sanitizeSharedResumableReturnTo } from '@baci/shared/lib';
import type { WalletReturnHref } from '@/lib/sanitize-wallet-return-to';

/**
 * Expo-router-typed wrapper over the shared strict allowlist so web and mobile
 * cannot drift. Used on the push-tap path: only the resumable purchase flows
 * are navigable from a wallet-credited notification, so an internal redirector
 * (e.g. `/auth/callback?returnTo=//evil.com`) can never be chained through.
 */
export function sanitizeResumableWalletReturnTo(
  value: unknown
): WalletReturnHref | undefined {
  const path = sanitizeSharedResumableReturnTo(value);
  // Allowlisted internal destinations are valid expo-router hrefs.
  return path === undefined ? undefined : (path as WalletReturnHref);
}
