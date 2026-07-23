'use client';

import { useEffect, useRef, useState } from 'react';
import { WALLET_FUNDING_POLL } from '@/config/wallet-funding-poll';
import { captureClientEvent } from '@/lib/posthog/capture-client-event';
import {
  WALLET_FUNDING_TELEMETRY,
  type WalletFundingSurface,
} from '@/lib/posthog/wallet-funding-events';
import { walletFundingCreditApi } from './wallet-funding-credit-api';
import {
  detectWalletTopUpCredit,
  type WalletTopUpCredit,
} from './wallet-funding-credit-detection';

export type WalletFundingCheckStatus =
  | 'checking'
  | 'credited'
  | 'idle'
  | 'timed_out';

export interface UseWalletFundingCreditPollOptions {
  customerId?: string;
  /** Dark-launch flag AND "the customer can actually see an account number". */
  enabled: boolean;
  /**
   * Transaction ids already in the wallet snapshot, from the parent's fetch.
   *
   * SAFETY INVARIANT: an EMPTY array must mean "this wallet genuinely has no
   * transactions", never "we failed to load them". An empty baseline that
   * actually meant "unknown" would make the first poll read a PRE-EXISTING
   * top-up as the transfer the customer just made. `GET /api/storefront/
   * customer/wallet` upholds this by returning 500 (not `transactions: []`)
   * whenever the wallet or transactions read errors — see that route's
   * `route.baseline-integrity.test.ts`.
   */
  knownTransactionIds: readonly string[];
  merchantSlug: string | undefined;
  onCredited: (credit: WalletTopUpCredit) => void;
  surface: WalletFundingSurface;
}

interface UseWalletFundingCreditPollReturn {
  creditedAmount: number | null;
  /** Arms the loop ("I've transferred") and re-arms it after a timeout. */
  start: () => void;
  status: WalletFundingCheckStatus;
}

/**
 * The web half of the wallet funding checking loop. Mirrors the proven USDT
 * poll (immediate first call, 5s interval, `cancelled` flag + post-await
 * recheck, cleanup) with three deliberate improvements for the NGN leg: it is
 * only ever armed by an explicit customer action, it is bounded by
 * `WALLET_FUNDING_POLL.maxAttempts`, and it skips polls while the tab is hidden
 * (the customer is in their bank app) instead of burning the budget.
 *
 * Settling is fail-closed: only a NEW `wallet_topup` credit settles as
 * `credited`. API errors, unparseable payloads and cashback/refund credits all
 * keep the loop running until it times out.
 */
export function useWalletFundingCreditPoll({
  customerId,
  enabled,
  knownTransactionIds,
  merchantSlug,
  onCredited,
  surface,
}: UseWalletFundingCreditPollOptions): UseWalletFundingCreditPollReturn {
  const [status, setStatus] = useState<WalletFundingCheckStatus>('idle');
  const [creditedAmount, setCreditedAmount] = useState<number | null>(null);
  const [baselineIds, setBaselineIds] = useState<readonly string[]>(
    knownTransactionIds
  );

  // While idle the baseline tracks the freshest wallet snapshot; arming freezes
  // it, so any top-up credit the poll then sees is provably new. Render-phase
  // adjustment (not an effect) keeps the frozen value correct on the very first
  // poll. Keyed on a joined string because the prop is a fresh array each render.
  const knownIdsKey = knownTransactionIds.join('|');
  const [baselineKey, setBaselineKey] = useState(knownIdsKey);
  if (status === 'idle' && baselineKey !== knownIdsKey) {
    setBaselineKey(knownIdsKey);
    setBaselineIds(knownTransactionIds);
  }

  // Full reset when the wallet IDENTITY changes (sign-out, account switch, or a
  // storefront switch while a `/wallet?fund=1` deep link keeps this panel
  // mounted). `pages/wallet.tsx` deliberately retains the funding panel for the
  // new identity, so without this a `credited` status, amount and frozen
  // baseline from the PREVIOUS customer would carry over and announce "Transfer
  // received" for a transfer that belongs to someone else. Render-phase sync
  // (not an effect) so the stale state never renders for the new identity — the
  // same customer-switch class as the mobile `wallet-funding-session` fix.
  const identityKey = `${customerId ?? ''}:${merchantSlug ?? ''}`;
  const [prevIdentityKey, setPrevIdentityKey] = useState(identityKey);
  if (identityKey !== prevIdentityKey) {
    setPrevIdentityKey(identityKey);
    setStatus('idle');
    setCreditedAmount(null);
    setBaselineIds(knownTransactionIds);
    setBaselineKey(knownIdsKey);
  }

  // Ref (written in an effect, never during render) so a parent re-render that
  // hands us a new callback identity cannot restart the poll and reset its
  // attempt budget.
  const onCreditedRef = useRef(onCredited);
  useEffect(() => {
    onCreditedRef.current = onCredited;
  }, [onCredited]);

  useEffect(() => {
    if (!enabled || status !== 'checking' || !merchantSlug) return;

    let cancelled = false;
    let attempts = 0;
    // A single request is in flight at most: a stalled GET must not let the
    // interval launch overlapping requests that pile up and defeat the bound.
    let inFlight = false;
    let activeController: AbortController | null = null;
    const known = new Set(baselineIds);

    const settle = (
      outcome: 'credited' | 'timed_out',
      credit: WalletTopUpCredit | null
    ) => {
      cancelled = true;
      captureClientEvent(
        WALLET_FUNDING_TELEMETRY.events.transferCheckSettled,
        {
          attempts,
          customer_id: customerId,
          merchant_slug: merchantSlug,
          outcome,
          surface,
        }
      );
      if (outcome === 'credited' && credit) {
        setCreditedAmount(credit.amount);
        setStatus('credited');
        onCreditedRef.current(credit);
        return;
      }
      setStatus('timed_out');
    };

    const refresh = async () => {
      if (cancelled || inFlight) return;
      // Don't spend the attempt budget while the customer is away in their bank
      // app; the visibilitychange listener polls again the moment they return.
      if (document.visibilityState === 'hidden') return;

      attempts += 1;
      inFlight = true;
      // Bound this individual request: on a degraded connection the GET can
      // stall forever, so abort it and let it settle as an error. That keeps
      // the attempt budget advancing so the overall loop still times out.
      const controller = new AbortController();
      activeController = controller;
      const abortTimer = setTimeout(() => {
        controller.abort();
      }, WALLET_FUNDING_POLL.requestTimeoutMs);

      let result: Awaited<ReturnType<typeof walletFundingCreditApi.poll>>;
      try {
        result = await walletFundingCreditApi.poll(merchantSlug, controller.signal);
      } finally {
        clearTimeout(abortTimer);
        inFlight = false;
        if (activeController === controller) {
          activeController = null;
        }
      }
      if (cancelled) return;

      const credit =
        result.kind === 'ready'
          ? detectWalletTopUpCredit(result.transactions, known)
          : null;
      if (credit) {
        settle('credited', credit);
        return;
      }
      // Misses AND errors alike: keep polling, then time out. Never credit.
      if (attempts >= WALLET_FUNDING_POLL.maxAttempts) {
        settle('timed_out', null);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refresh();
    };

    void refresh();
    const interval = setInterval(() => {
      void refresh();
    }, WALLET_FUNDING_POLL.intervalMs);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      clearInterval(interval);
      // Abort a still-pending request so a stall cannot outlive the effect.
      activeController?.abort();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [baselineIds, customerId, enabled, merchantSlug, status, surface]);

  const start = () => {
    if (!enabled || status === 'checking' || status === 'credited') return;
    captureClientEvent(WALLET_FUNDING_TELEMETRY.events.transferCheckStarted, {
      customer_id: customerId,
      merchant_slug: merchantSlug,
      surface,
    });
    setCreditedAmount(null);
    setStatus('checking');
  };

  return { creditedAmount, start, status };
}
