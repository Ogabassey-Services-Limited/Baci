import { useEffect, useRef, useState } from 'react';
import {
  WALLET_FUNDING_CHECKING_STATE_ENABLED,
  WALLET_FUNDING_POLLING,
} from '@/constants/wallet-funding';
import type { WalletReturnHref } from '@/lib/sanitize-wallet-return-to';
import {
  findLatestWalletTopUpCredit,
  isNewWalletTopUpCredit,
  type WalletTopUpCandidate,
  type WalletTopUpCredit,
} from './wallet-top-up-credit';

export type WalletCreditWatchStatus =
  | 'idle'
  | 'checking'
  | 'credited'
  | 'timedOut';

export interface WalletCreditWatch {
  armCheck: () => void;
  creditedAmount: number | null;
  /** Returns to idle so a later transfer can be checked from the same mount. */
  reset: () => void;
  returnCtaHref: WalletReturnHref | undefined;
  status: WalletCreditWatchStatus;
}

interface UseWalletCreditWatchArgs {
  /** Fallback poke used while realtime is down; reuse the wallet refetch. */
  refetch: () => unknown;
  /** Sanitized destination for the "Return to your purchase" CTA. */
  returnTo?: WalletReturnHref;
  /** Wallet ledger rows (`useWallet().data.transactions`); undefined = loading. */
  transactions: readonly WalletTopUpCandidate[] | undefined;
}

/**
 * Watches the existing `useWallet` query for a wallet TOP-UP credit after the
 * customer signals "I've transferred". It intentionally does NOT open a
 * Supabase channel — the wallet hook already owns one; when a credit lands,
 * that channel invalidates the query, the transaction list updates, and this
 * hook sees the new row. A fallback interval pokes `refetch` while realtime is
 * down, and the watch times out (never claiming credited) after `TIMEOUT_MS`.
 *
 * Detection is ledger-based, not balance-delta-based, for two reasons:
 *   1. Customers usually transfer BEFORE tapping "I've transferred", so the
 *      credit can land while they are away in their bank app. The hook
 *      snapshots the newest top-up row seen while idle and arms against it, so
 *      a pre-tap credit reads as an immediate hit instead of timing out.
 *   2. A balance snapshot cannot tell a bank transfer from cashback, a refund,
 *      an order reversal, or a savings move — all of which raise the spendable
 *      balance and would false-positive "Wallet credited". Only rows with
 *      `source_type = 'wallet_topup'` are funding credits, and the credited
 *      amount is read straight off that row.
 */
export function useWalletCreditWatch({
  refetch,
  returnTo,
  transactions,
}: UseWalletCreditWatchArgs): WalletCreditWatch {
  const [status, setStatus] = useState<WalletCreditWatchStatus>('idle');
  const [creditedAmount, setCreditedAmount] = useState<number | null>(null);
  const baselineRef = useRef<WalletTopUpCredit | null>(null);
  const idleBaselineRef = useRef<WalletTopUpCredit | null>(null);
  const hasIdleBaselineRef = useRef(false);
  const refetchRef = useRef(refetch);

  useEffect(() => {
    refetchRef.current = refetch;
  }, [refetch]);

  // Snapshot the pre-transfer ledger position: the newest top-up credit that
  // already existed while idle. Render-phase (guarded, converges) to match the
  // detection below. `undefined` transactions mean the query is still loading —
  // snapshotting then would treat the customer's existing top-up history as new.
  if (status === 'idle' && !hasIdleBaselineRef.current && transactions) {
    hasIdleBaselineRef.current = true;
    idleBaselineRef.current = findLatestWalletTopUpCredit(transactions);
  }

  // Detect the credit render-phase (mirrors the codebase's "adjust state during
  // render" pattern) so consumers never paint a stale "checking" frame after the
  // credit has already landed. Converges: the guard only fires while
  // status === 'checking', and it immediately transitions out of it.
  if (status === 'checking') {
    const latest = findLatestWalletTopUpCredit(transactions);
    if (latest && isNewWalletTopUpCredit(latest, baselineRef.current)) {
      setCreditedAmount(latest.amount);
      setStatus('credited');
    }
  }

  useEffect(() => {
    if (status !== 'checking') {
      return;
    }
    const interval = setInterval(() => {
      void refetchRef.current();
    }, WALLET_FUNDING_POLLING.INTERVAL_MS);
    const timeout = setTimeout(() => {
      setStatus((prev) => (prev === 'checking' ? 'timedOut' : prev));
    }, WALLET_FUNDING_POLLING.TIMEOUT_MS);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [status]);

  const armCheck = () => {
    if (!WALLET_FUNDING_CHECKING_STATE_ENABLED) {
      return;
    }
    // Never arm without a loaded ledger: arming while the wallet query is still
    // loading would baseline against "no top-ups ever" and false-positive on the
    // customer's pre-existing top-up history the moment it arrives.
    if (!hasIdleBaselineRef.current) {
      return;
    }
    baselineRef.current = idleBaselineRef.current;
    setCreditedAmount(null);
    setStatus('checking');
    void refetchRef.current();
  };

  const reset = () => {
    baselineRef.current = null;
    // Re-snapshot on the next idle render so the following cycle only reports
    // top-ups made after this acknowledgement was dismissed.
    hasIdleBaselineRef.current = false;
    idleBaselineRef.current = null;
    setCreditedAmount(null);
    setStatus('idle');
  };

  return {
    armCheck,
    creditedAmount,
    reset,
    returnCtaHref: status === 'credited' ? returnTo : undefined,
    status,
  };
}
