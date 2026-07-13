import {
  WALLET_FUNDING_TELEMETRY,
  type WalletFundingFailureReason,
} from '@/lib/posthog/wallet-funding-events';

/**
 * Maps a funding-account API `code` to a telemetry reason. Known server codes
 * pass through verbatim; anything unrecognized (including a missing code)
 * collapses to `other`. Network/transport failures are reported separately by
 * the caller as `network`.
 */
export function resolveWalletFundingFailureReason(
  code: unknown
): WalletFundingFailureReason {
  switch (code) {
    case WALLET_FUNDING_TELEMETRY.reasons.orderAliasConflict:
      return WALLET_FUNDING_TELEMETRY.reasons.orderAliasConflict;
    case WALLET_FUNDING_TELEMETRY.reasons.customerPhoneRequired:
      return WALLET_FUNDING_TELEMETRY.reasons.customerPhoneRequired;
    case WALLET_FUNDING_TELEMETRY.reasons.dvaDisabled:
      return WALLET_FUNDING_TELEMETRY.reasons.dvaDisabled;
    default:
      return WALLET_FUNDING_TELEMETRY.reasons.other;
  }
}
