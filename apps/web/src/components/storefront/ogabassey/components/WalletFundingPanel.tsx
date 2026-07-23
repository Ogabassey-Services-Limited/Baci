'use client';

import type {
  StorefrontWalletFundingAccount,
  StorefrontWalletTransaction,
} from '@baci/shared';
import { Copy, Landmark, Loader2, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from '@/hooks/use-toast';
import { captureClientEvent } from '@/lib/posthog/capture-client-event';
import {
  WALLET_FUNDING_TELEMETRY,
  type WalletFundingSurface,
} from '@/lib/posthog/wallet-funding-events';
import { isWalletFundingCheckLoopEnabled } from '@/lib/wallet-funding-check-loop-flag';
import { requestFundingAccount } from './wallet-funding-account-request';
import { useWalletFundingCreditPoll } from './use-wallet-funding-credit-poll';
import { WalletFundingCheckStatus } from './WalletFundingCheckStatus';
import { WALLET_FUNDING_COPY } from './wallet-funding-copy';

interface WalletFundingPanelProps {
  account: StorefrontWalletFundingAccount | null;
  /**
   * Create the account without the extra consent click. Only pass true when
   * the panel is opened by an explicit "Pay with Bank Transfer" action —
   * that action IS the customer's consent.
   */
  autoCreate?: boolean;
  /** Signed-in customer id, stamped on funnel events to join client/server legs. */
  customerId?: string;
  merchantSlug: string | undefined;
  onAccountCreated: (account: StorefrontWalletFundingAccount) => void;
  /** Called once the check loop detects a NEW `wallet_topup` credit. */
  onCredited?: () => void;
  onRefreshBalance?: () => void;
  /** Utility surface only — resumes the paused purchase (prefill, no submit). */
  onReturnToPurchase?: () => void;
  requiresConsent: boolean;
  /** Which surface rendered the panel — drives the `surface` funnel property. */
  surface: WalletFundingSurface;
  /** Wallet snapshot the parent already fetched — the check loop's baseline. */
  walletTransactions?: readonly StorefrontWalletTransaction[];
}

export function WalletFundingPanel({
  account,
  autoCreate = false,
  customerId,
  merchantSlug,
  onAccountCreated,
  onCredited,
  onRefreshBalance,
  onReturnToPurchase,
  requiresConsent,
  surface,
  walletTransactions,
}: WalletFundingPanelProps) {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoCreateAttempted, setAutoCreateAttempted] = useState(false);
  const [surfaceReported, setSurfaceReported] = useState(false);
  // Id of the detected top-up. The return-to-purchase CTA stays gated until the
  // REFRESHED wallet snapshot actually contains this credit — returning before
  // then lands the customer on a checkout that still reads insufficient balance.
  const [creditedTransactionId, setCreditedTransactionId] = useState<
    string | null
  >(null);

  // Dark-launched: flag off keeps the manual refresh button and never polls.
  // Only armed once the customer can see an account number to transfer to.
  const checkLoopEnabled = isWalletFundingCheckLoopEnabled() && Boolean(account);
  const creditPoll = useWalletFundingCreditPoll({
    customerId,
    enabled: checkLoopEnabled,
    knownTransactionIds: (walletTransactions ?? []).map(
      (transaction) => transaction.id
    ),
    merchantSlug,
    onCredited: (credit) => {
      setCreditedTransactionId(credit.id);
      onRefreshBalance?.();
      onCredited?.();
    },
    surface,
  });

  // Fail-closed gate for the return CTA: only ready once the parent's refreshed
  // wallet snapshot reflects the detected credit (its txn id is now present).
  const returnReady =
    creditedTransactionId !== null &&
    (walletTransactions ?? []).some(
      (transaction) => transaction.id === creditedTransactionId
    );

  // Fire the funnel-entry event once, but only after the merchant context has
  // resolved — a pre-merchant mount would lose the attribution. State-guarded
  // (not a dependency array) to match the auto-create effect below.
  useEffect(() => {
    if (surfaceReported || !merchantSlug) {
      return;
    }
    setSurfaceReported(true);
    captureClientEvent(WALLET_FUNDING_TELEMETRY.events.surfaceOpened, {
      surface,
      auto_create: autoCreate,
      has_existing_account: Boolean(account),
      merchant_slug: merchantSlug,
      customer_id: customerId,
    });
  });

  const handleCreate = async () => {
    if (!merchantSlug || creating) return;
    captureClientEvent(WALLET_FUNDING_TELEMETRY.events.createAttempted, {
      surface,
      auto_create: autoCreate,
      merchant_slug: merchantSlug,
      customer_id: customerId,
    });
    setCreating(true);
    setError(null);
    const result = await requestFundingAccount(merchantSlug);
    if (result.kind === 'created') {
      captureClientEvent(WALLET_FUNDING_TELEMETRY.events.accountCreated, {
        surface,
        provider: result.account.provider,
        merchant_slug: merchantSlug,
        customer_id: customerId,
      });
      onAccountCreated(result.account);
    } else {
      captureClientEvent(WALLET_FUNDING_TELEMETRY.events.createFailed, {
        surface,
        reason: result.reason,
        merchant_slug: merchantSlug,
        customer_id: customerId,
      });
      setError(result.message);
    }
    setCreating(false);
  };

  useEffect(() => {
    if (
      !autoCreate ||
      autoCreateAttempted ||
      account ||
      !requiresConsent ||
      !merchantSlug
    ) {
      return;
    }
    setAutoCreateAttempted(true);
    void handleCreate();
  });

  const handleCopy = async () => {
    if (!account) return;
    try {
      await navigator.clipboard.writeText(account.accountNumber);
      toast({ title: WALLET_FUNDING_COPY.copied });
    } catch {
      // Clipboard access denied — the number is still visible to copy manually.
    }
  };

  return (
    <div className="rounded-xl border border-store-primary/20 bg-store-primary/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Landmark className="text-store-primary" size={18} />
        <p className="text-sm font-bold text-gray-900">
          {WALLET_FUNDING_COPY.title}
        </p>
      </div>

      {account ? (
        <>
          <p className="text-xs text-gray-600">
            {WALLET_FUNDING_COPY.subtitle}
          </p>
          <div className="rounded-lg bg-white border border-gray-200 p-3 space-y-1">
            <p className="text-xs text-gray-500">{account.bankName}</p>
            <div className="flex items-center justify-between gap-2">
              <p className="text-lg font-bold tracking-wider text-gray-900">
                {account.accountNumber}
              </p>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                <Copy size={12} />
                {WALLET_FUNDING_COPY.copyCta}
              </button>
            </div>
            {account.accountName ? (
              <p className="text-xs text-gray-500">{account.accountName}</p>
            ) : null}
          </div>
          <p className="text-xs font-medium text-store-primary">
            {WALLET_FUNDING_COPY.feeNote}
          </p>
          {checkLoopEnabled ? (
            <WalletFundingCheckStatus
              creditedAmount={creditPoll.creditedAmount}
              onCheck={creditPoll.start}
              onReturnToPurchase={onReturnToPurchase}
              onRetryRefresh={onRefreshBalance}
              returnReady={returnReady}
              status={creditPoll.status}
            />
          ) : onRefreshBalance ? (
            <button
              type="button"
              onClick={onRefreshBalance}
              className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 hover:text-gray-900"
            >
              <RefreshCw size={12} />
              {WALLET_FUNDING_COPY.refreshCta}
            </button>
          ) : null}
        </>
      ) : requiresConsent ? (
        <>
          <p className="text-xs text-gray-600">
            {WALLET_FUNDING_COPY.consentBlurb}
          </p>
          <p className="text-xs font-medium text-store-primary">
            {WALLET_FUNDING_COPY.feeNote}
          </p>
          <button
            type="button"
            disabled={creating}
            onClick={handleCreate}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-store-primary px-3 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
          >
            {creating ? (
              <>
                <Loader2 className="animate-spin" size={14} />
                {WALLET_FUNDING_COPY.creating}
              </>
            ) : (
              WALLET_FUNDING_COPY.consentCta
            )}
          </button>
        </>
      ) : (
        <p className="text-xs text-gray-600">
          {WALLET_FUNDING_COPY.unavailable}
        </p>
      )}

      {error ? <p className="text-xs font-medium text-red-600">{error}</p> : null}
    </div>
  );
}
