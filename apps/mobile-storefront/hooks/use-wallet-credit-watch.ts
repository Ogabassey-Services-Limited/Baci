import { useEffect, useRef, useState } from 'react';
import {
  WALLET_FUNDING_CHECKING_STATE_ENABLED,
  WALLET_FUNDING_POLLING,
} from '@/constants/wallet-funding';
import type { WalletReturnHref } from '@/lib/sanitize-wallet-return-to';

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
  /** Spendable wallet balance (`wallet.balance`), not `total_balance`. */
  balance: number | undefined;
  /** Fallback poke used while realtime is down; reuse the wallet refetch. */
  refetch: () => unknown;
  /** Sanitized destination for the "Return to your purchase" CTA. */
  returnTo?: WalletReturnHref;
}

function isFiniteBalance(balance: number | undefined): balance is number {
  return typeof balance === 'number' && Number.isFinite(balance);
}

/**
 * Watches the existing `useWallet` query for a credit after the customer
 * signals "I've transferred". It intentionally does NOT open a Supabase channel
 * — the wallet hook already owns one; when a credit lands, that channel
 * invalidates the query, the balance prop updates, and this hook sees the
 * delta. A fallback interval pokes `refetch` while realtime is down, and the
 * watch times out (never claiming credited) after `TIMEOUT_MS`.
 *
 * Customers usually transfer BEFORE tapping "I've transferred", so the credit
 * can land (via realtime or a focus refetch) while they are away in their bank
 * app. The hook therefore snapshots the first balance it sees while idle and
 * arms against the LOWER of that snapshot and the at-tap balance — a pre-tap
 * credit then reads as an immediate positive delta instead of being absorbed
 * into the baseline and timing out.
 */
export function useWalletCreditWatch({
  balance,
  refetch,
  returnTo,
}: UseWalletCreditWatchArgs): WalletCreditWatch {
  const [status, setStatus] = useState<WalletCreditWatchStatus>('idle');
  const [creditedAmount, setCreditedAmount] = useState<number | null>(null);
  const baselineRef = useRef<number | null>(null);
  const idleBaselineRef = useRef<number | null>(null);
  const refetchRef = useRef(refetch);

  useEffect(() => {
    refetchRef.current = refetch;
  }, [refetch]);

  // Snapshot the pre-transfer balance: the first finite balance seen while
  // idle. Render-phase (guarded, converges) to match the detection below.
  if (
    status === 'idle' &&
    idleBaselineRef.current === null &&
    isFiniteBalance(balance)
  ) {
    idleBaselineRef.current = balance;
  }

  // Detect the credit render-phase (mirrors the codebase's "adjust state during
  // render" pattern) so consumers never paint a stale "checking" frame after
  // the balance has already grown. Converges: the guard only fires while
  // status === 'checking', and it immediately transitions out of it.
  if (
    status === 'checking' &&
    baselineRef.current !== null &&
    isFiniteBalance(balance) &&
    balance > baselineRef.current
  ) {
    setCreditedAmount(balance - baselineRef.current);
    setStatus('credited');
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
    const atTap = isFiniteBalance(balance) ? balance : null;
    const idleSnapshot = idleBaselineRef.current;
    // Never arm without a real baseline: arming while the balance is still
    // loading would record 0 and false-positive "credited" (with a bogus
    // amount) the moment the actual balance arrives.
    if (atTap === null && idleSnapshot === null) {
      return;
    }
    // The lower of the two survives a credit that landed before the tap.
    baselineRef.current =
      atTap !== null && idleSnapshot !== null
        ? Math.min(atTap, idleSnapshot)
        : (atTap ?? idleSnapshot);
    setCreditedAmount(null);
    setStatus('checking');
    void refetchRef.current();
  };

  const reset = () => {
    baselineRef.current = null;
    // Re-snapshot at the current balance so the next cycle measures only
    // transfers made after this acknowledgement was dismissed.
    idleBaselineRef.current = isFiniteBalance(balance) ? balance : null;
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
