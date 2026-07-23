'use client';

import { useRef, useState } from 'react';
import type { WalletOrderFundingIntent } from '@/schemas/order-wallet-funding-intent';
import type { WalletFundingAccountResponse } from '@/schemas/wallet-funding-account';
import { startWalletFundedBankTransfer } from '../wallet-funded-bank-transfer';
import { useWalletFundingPolling } from './use-wallet-funding-polling';

export interface WalletFundedTransferSession {
  account: WalletFundingAccountResponse;
  checkoutFingerprint: string;
  intent: WalletOrderFundingIntent;
  orderId: string;
  trackingToken?: string;
}

export interface WalletFundedOrderPaidPayload {
  checkoutFingerprint: string;
  orderId: string;
  trackingToken?: string;
}

/**
 * - `started`   — the wallet-funded transfer session is live; the modal is up.
 * - `fallback`  — a definite decline; the caller runs the legacy order-DVA path.
 * - `uncertain` — the create-intent POST outcome was indeterminate; the caller
 *   MUST NOT run the legacy path (double-charge risk) and instead prompts the
 *   customer to check their wallet / retry.
 */
export type WalletFundedTransferStartOutcome =
  | 'started'
  | 'fallback'
  | 'uncertain';

interface StartArgs {
  checkoutFingerprint: string;
  merchantId: string;
  merchantSlug?: string;
  orderId: string;
  trackingToken?: string;
}

/**
 * Owns the whole web wallet-funded bank-transfer session: create the intent
 * (with the consent round-trip), keep it polled, and hand the caller a single
 * boolean so the legacy order-DVA path stays the fallback.
 *
 * `start()` resolves a three-way outcome (`started` / `fallback` / `uncertain`):
 * only `fallback` may run the untouched legacy order-DVA path. `uncertain` means
 * the create-intent POST may have committed server-side, so the caller must
 * surface a check-your-wallet/retry state rather than opening a second funding
 * path. It never throws.
 */
export function useWalletFundedBankTransfer({
  merchantId,
  merchantSlug,
  onOrderPaid,
}: {
  merchantId: string | undefined;
  merchantSlug: string | undefined;
  onOrderPaid: (payload: WalletFundedOrderPaidPayload) => void;
}) {
  const [session, setSession] = useState<WalletFundedTransferSession | null>(
    null
  );
  const [consentRequested, setConsentRequested] = useState(false);
  const consentResolverRef = useRef<((granted: boolean) => void) | null>(null);
  const sessionRef = useRef<WalletFundedTransferSession | null>(null);
  sessionRef.current = session;

  const { checkNow, error, intent, isChecking } = useWalletFundingPolling({
    enabled: Boolean(session),
    intentId: session?.intent.id,
    merchantId,
    merchantSlug,
    onCompleted: () => {
      const current = sessionRef.current;
      if (!current) {
        return;
      }
      onOrderPaid({
        checkoutFingerprint: current.checkoutFingerprint,
        orderId: current.orderId,
        trackingToken: current.trackingToken,
      });
    },
  });

  const resolveConsent = (granted: boolean) => {
    const resolve = consentResolverRef.current;
    consentResolverRef.current = null;
    setConsentRequested(false);
    resolve?.(granted);
  };

  const start = async ({
    checkoutFingerprint,
    merchantId: startMerchantId,
    merchantSlug: startMerchantSlug,
    orderId,
    trackingToken,
  }: StartArgs): Promise<WalletFundedTransferStartOutcome> => {
    const result = await startWalletFundedBankTransfer({
      merchantId: startMerchantId,
      merchantSlug: startMerchantSlug,
      orderId,
      requestConsent: () =>
        new Promise<boolean>((resolve) => {
          consentResolverRef.current = resolve;
          setConsentRequested(true);
        }),
    });

    if (result.kind === 'fallback') {
      return 'fallback';
    }
    if (result.kind === 'uncertain') {
      return 'uncertain';
    }

    setSession({
      account: result.account,
      checkoutFingerprint,
      intent: result.intent,
      orderId,
      trackingToken,
    });
    return 'started';
  };

  return {
    account: session?.account ?? null,
    acceptConsent: () => resolveConsent(true),
    checkNow,
    close: () => setSession(null),
    consentRequested,
    declineConsent: () => resolveConsent(false),
    error,
    // The polled intent supersedes the one returned at creation time.
    intent: intent ?? session?.intent ?? null,
    isChecking,
    start,
  };
}
