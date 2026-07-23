'use client';

import { CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import type { WalletFundingCheckStatus as CheckStatus } from './use-wallet-funding-credit-poll';
import { WALLET_FUNDING_COPY } from './wallet-funding-copy';

const NGN_FORMATTER: Intl.NumberFormat = new Intl.NumberFormat('en-NG', {
  currency: 'NGN',
  style: 'currency',
});

interface WalletFundingCheckStatusProps {
  /** Amount of the detected top-up credit; `null` until one is detected. */
  creditedAmount: number | null;
  onCheck: () => void;
  /** Utility surface only — prefills the paused purchase, never submits it. */
  onReturnToPurchase?: () => void;
  /**
   * Gates the return CTA: only enable it once the refreshed wallet actually
   * reflects the credit. Returning before then lands the customer back on a
   * checkout that still reads their balance as insufficient. Defaults to `true`
   * for surfaces that have no purchase to return to.
   */
  returnReady?: boolean;
  status: CheckStatus;
}

/**
 * The "I've transferred — checking…" affordance. It replaces the manual refresh
 * button rather than competing with it. The timed-out branch never claims the
 * money arrived: a timeout only means we have not seen it yet.
 */
export function WalletFundingCheckStatus({
  creditedAmount,
  onCheck,
  onReturnToPurchase,
  returnReady = true,
  status,
}: WalletFundingCheckStatusProps) {
  if (status === 'checking') {
    return (
      <div aria-live="polite" className="space-y-1">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
          <Loader2 aria-hidden="true" className="animate-spin" size={12} />
          {WALLET_FUNDING_COPY.checkChecking}
        </p>
        <p className="text-xs text-gray-500">
          {WALLET_FUNDING_COPY.checkCheckingHint}
        </p>
      </div>
    );
  }

  if (status === 'credited') {
    return (
      <div aria-live="polite" className="space-y-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-store-primary">
          <CheckCircle2 aria-hidden="true" size={12} />
          {WALLET_FUNDING_COPY.checkCredited}
          {typeof creditedAmount === 'number'
            ? ` (${NGN_FORMATTER.format(creditedAmount)})`
            : ''}
        </p>
        {onReturnToPurchase ? (
          returnReady ? (
            <button
              className="w-full rounded-lg bg-store-primary px-3 py-2 text-sm font-bold text-white hover:opacity-90"
              onClick={onReturnToPurchase}
              type="button"
            >
              {WALLET_FUNDING_COPY.returnToPurchaseCta}
            </button>
          ) : (
            <div className="space-y-1">
              <button
                className="w-full cursor-not-allowed rounded-lg bg-store-primary/60 px-3 py-2 text-sm font-bold text-white"
                disabled
                type="button"
              >
                {WALLET_FUNDING_COPY.returnToPurchaseCta}
              </button>
              <p aria-live="polite" className="text-xs text-gray-500">
                {WALLET_FUNDING_COPY.returnUpdatingBalance}
              </p>
            </div>
          )
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {status === 'timed_out' ? (
        <p aria-live="polite" className="text-xs text-gray-600">
          {WALLET_FUNDING_COPY.checkTimedOut}
        </p>
      ) : null}
      <button
        className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 hover:text-gray-900"
        onClick={onCheck}
        type="button"
      >
        <RefreshCw aria-hidden="true" size={12} />
        {status === 'timed_out'
          ? WALLET_FUNDING_COPY.checkAgainCta
          : WALLET_FUNDING_COPY.checkStartCta}
      </button>
    </div>
  );
}
