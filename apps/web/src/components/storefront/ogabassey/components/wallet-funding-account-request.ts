import type { StorefrontWalletFundingAccount } from '@baci/shared';
import { fetchWithCsrf } from '@/lib/api-client';
import {
  WALLET_FUNDING_TELEMETRY,
  type WalletFundingFailureReason,
} from '@/lib/posthog/wallet-funding-events';
import { resolveWalletFundingFailureReason } from '@/lib/posthog/wallet-funding-failure-reason';
import { WALLET_FUNDING_COPY } from './wallet-funding-copy';

export type CreateAccountResult =
  | { kind: 'created'; account: StorefrontWalletFundingAccount }
  | {
      kind: 'error';
      message: string;
      reason: WalletFundingFailureReason;
    };

/**
 * Module-scope network helper: keeps the async try/catch out of the component
 * body so React Compiler can memoize `WalletFundingPanel`. Every failure mode —
 * non-2xx, a missing account, a network error — collapses to a typed
 * `{ kind: 'error' }` carrying a customer-facing message and a telemetry reason.
 */
export const requestFundingAccount = async (
  merchantSlug: string
): Promise<CreateAccountResult> => {
  try {
    const response = await fetchWithCsrf(
      '/api/storefront/customer/wallet/funding-account',
      {
        method: 'POST',
        body: JSON.stringify({ consent: true, merchantSlug }),
      }
    );
    const data = await response.json();
    if (!response.ok || !data.account) {
      const reason = resolveWalletFundingFailureReason(data.code);
      // The customer's Paystack NUBAN is inside an active order-payment
      // reservation window (max ~90 min) — actionable, not a hard failure.
      if (data.code === 'WALLET_DVA_ORDER_ALIAS_CONFLICT') {
        return {
          kind: 'error',
          message: WALLET_FUNDING_COPY.orderPaymentInProgress,
          reason,
        };
      }
      return {
        kind: 'error',
        message:
          typeof data.error === 'string'
            ? data.error
            : WALLET_FUNDING_COPY.unavailable,
        reason,
      };
    }
    return { kind: 'created', account: data.account };
  } catch {
    return {
      kind: 'error',
      message: WALLET_FUNDING_COPY.unavailable,
      reason: WALLET_FUNDING_TELEMETRY.reasons.network,
    };
  }
};
