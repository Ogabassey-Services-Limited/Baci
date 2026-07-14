import {
  WALLET_FUNDING_TELEMETRY,
  type WalletFundingFailureReason,
} from '@/lib/posthog/wallet-funding-events';

// Every known `CustomerWalletPaymentAccountError` API code passes through
// verbatim; only the synthetic client-side buckets are excluded from matching.
const KNOWN_API_REASONS = new Set<string>(
  Object.values(WALLET_FUNDING_TELEMETRY.reasons).filter(
    (reason) =>
      reason !== WALLET_FUNDING_TELEMETRY.reasons.network &&
      reason !== WALLET_FUNDING_TELEMETRY.reasons.other
  )
);

/**
 * Maps a funding-account API `code` to a telemetry reason. Known server codes
 * (config, conflict, and Paystack provider errors included) pass through
 * verbatim so the funnel can distinguish merchant-config drops from provider
 * failures; anything unrecognized (including a missing code) collapses to
 * `other`. Network/transport failures are reported separately by the caller
 * as `network`.
 */
export function resolveWalletFundingFailureReason(
  code: unknown
): WalletFundingFailureReason {
  if (typeof code === 'string' && KNOWN_API_REASONS.has(code)) {
    return code as WalletFundingFailureReason;
  }
  return WALLET_FUNDING_TELEMETRY.reasons.other;
}
