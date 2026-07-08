'use client';

import type { StorefrontWalletFundingAccount } from '@baci/shared';
import { Copy, Landmark, Loader2, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from '@/hooks/use-toast';
import { fetchWithCsrf } from '@/lib/api-client';
import { WALLET_FUNDING_COPY } from './wallet-funding-copy';

interface WalletFundingPanelProps {
  account: StorefrontWalletFundingAccount | null;
  /**
   * Create the account without the extra consent click. Only pass true when
   * the panel is opened by an explicit "Pay with Bank Transfer" action —
   * that action IS the customer's consent.
   */
  autoCreate?: boolean;
  merchantSlug: string | undefined;
  onAccountCreated: (account: StorefrontWalletFundingAccount) => void;
  onRefreshBalance?: () => void;
  requiresConsent: boolean;
}

type CreateAccountResult =
  | { kind: 'created'; account: StorefrontWalletFundingAccount }
  | { kind: 'error'; message: string };

// Module-scope helper keeps async try/catch out of the component body so
// React Compiler can memoize WalletFundingPanel.
const requestFundingAccount = async (
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
      // The customer's Paystack NUBAN is inside an active order-payment
      // reservation window (max ~90 min) — actionable, not a hard failure.
      if (data.code === 'WALLET_DVA_ORDER_ALIAS_CONFLICT') {
        return {
          kind: 'error',
          message: WALLET_FUNDING_COPY.orderPaymentInProgress,
        };
      }
      return {
        kind: 'error',
        message:
          typeof data.error === 'string'
            ? data.error
            : WALLET_FUNDING_COPY.unavailable,
      };
    }
    return { kind: 'created', account: data.account };
  } catch {
    return { kind: 'error', message: WALLET_FUNDING_COPY.unavailable };
  }
};

export function WalletFundingPanel({
  account,
  autoCreate = false,
  merchantSlug,
  onAccountCreated,
  onRefreshBalance,
  requiresConsent,
}: WalletFundingPanelProps) {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoCreateAttempted, setAutoCreateAttempted] = useState(false);

  const handleCreate = async () => {
    if (!merchantSlug || creating) return;
    setCreating(true);
    setError(null);
    const result = await requestFundingAccount(merchantSlug);
    if (result.kind === 'created') {
      onAccountCreated(result.account);
    } else {
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
          {onRefreshBalance ? (
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
