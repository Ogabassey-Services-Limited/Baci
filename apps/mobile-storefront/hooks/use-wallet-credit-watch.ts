import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  WALLET_FUNDING_CHECKING_STATE_ENABLED,
  WALLET_FUNDING_POLLING,
} from '@/constants/wallet-funding';
import type { WalletReturnHref } from '@/lib/sanitize-wallet-return-to';
import {
  clearWalletFundingSession,
  readWalletFundingSession,
} from '@/lib/wallet-funding-session';
import {
  findLatestWalletTopUpCredit,
  findLatestWalletTopUpCreditAtOrBefore,
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
  /**
   * Scopes the persisted bank-transfer funding session. Omitted (or absent
   * while auth hydrates) → no session is read and the hook baselines on the
   * ledger rows present at first idle render.
   */
  customerId?: string;
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
 *      credit can land while they are away in their bank app — and the wallet
 *      screen is frequently backgrounded or KILLED while they are there. The
 *      baseline is therefore anchored on the PERSISTED bank-transfer funding
 *      session (`lib/wallet-funding-session`), not on whatever happened to be
 *      in the ledger at first render: the newest top-up at or before
 *      `startedAt`. Any top-up strictly after it is a genuine new credit, so a
 *      pre-tap credit is detected even when the screen remounted after the
 *      money already landed. With no session (no customer yet, expired,
 *      unreadable) it falls back to the newest top-up seen while idle, which is
 *      still correct for a customer who never left the mounted screen.
 *   2. A balance snapshot cannot tell a bank transfer from cashback, a refund,
 *      an order reversal, or a savings move — all of which raise the spendable
 *      balance and would false-positive "Wallet credited". Only rows with
 *      `source_type = 'wallet_topup'` are funding credits, and the credited
 *      amount is read straight off that row.
 */
export function useWalletCreditWatch({
  customerId,
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

  // `null` cutoff = no funding session; snapshot the plain ledger head instead.
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);
  // Gates the snapshot so it can never be taken with a not-yet-loaded session
  // (which would baseline on the ledger head and swallow a landed credit).
  const [isSessionResolved, setIsSessionResolved] = useState(!customerId);
  const [prevCustomerId, setPrevCustomerId] = useState(customerId);
  if (prevCustomerId !== customerId) {
    // Account switch / auth hydration: discard the other customer's anchor and
    // re-resolve. Render-phase state adjustment (the codebase's derive pattern);
    // no refs are written here, so an abandoned render leaves nothing behind.
    setPrevCustomerId(customerId);
    setSessionStartedAt(null);
    setIsSessionResolved(!customerId);
  }

  useEffect(() => {
    refetchRef.current = refetch;
  }, [refetch]);

  useEffect(() => {
    if (!customerId) {
      return;
    }
    let isActive = true;
    const resolve = (startedAt: number | null) => {
      if (!isActive) {
        return;
      }
      setSessionStartedAt(startedAt);
      setIsSessionResolved(true);
    };
    // `readWalletFundingSession` already swallows storage errors; the `catch` is
    // a belt-and-braces guarantee that a storage failure can never wedge the
    // watch in "unresolved" (it degrades to the row snapshot, never to a
    // false 'credited').
    void readWalletFundingSession(customerId)
      .then((session) => resolve(session?.startedAt ?? null))
      .catch(() => resolve(null));
    return () => {
      isActive = false;
    };
  }, [customerId]);

  // A customerId transition — async auth hydration (undefined→id, which happens
  // right after mount) or an account switch — means any snapshot already taken
  // was baselined WITHOUT this customer's funding-session anchor: on a cold start
  // the persisted react-query cache can hand us the ledger before the auth store
  // hydrates, and that snapshot would latch onto the very credit the session
  // anchor exists to detect. Drop it so it is retaken once the session resolves.
  // Commit-phase (layout effect), so no abandoned render can clear it; declared
  // before the snapshot effect below so it runs first in the same commit.
  // biome-ignore lint/correctness/useExhaustiveDependencies: customerId is the trigger, not a read value — the effect exists to re-run on a customer change
  useLayoutEffect(() => {
    hasIdleBaselineRef.current = false;
    idleBaselineRef.current = null;
  }, [customerId]);

  // Snapshot the pre-transfer ledger position: the newest top-up credit that
  // already existed when the customer began the transfer (or, with no session,
  // while idle). This MUST NOT run during render. Unlike the status transition
  // below (pure state adjustment — React discards it with the render that
  // produced it), a ref write survives an abandoned concurrent render: a render
  // that never commits could latch `hasIdleBaselineRef` against a ledger the
  // customer never saw, and `armCheck` would then baseline against that phantom
  // snapshot. A layout effect only runs for a COMMITTED render, so the baseline
  // always matches ledger state that actually reached the screen. `undefined`
  // transactions mean the query is still loading — snapshotting then would treat
  // the customer's existing top-up history as new.
  useLayoutEffect(() => {
    if (
      status !== 'idle' ||
      hasIdleBaselineRef.current ||
      !transactions ||
      !isSessionResolved
    ) {
      return;
    }
    hasIdleBaselineRef.current = true;
    idleBaselineRef.current =
      sessionStartedAt === null
        ? findLatestWalletTopUpCredit(transactions)
        : findLatestWalletTopUpCreditAtOrBefore(transactions, sessionStartedAt);
  }, [isSessionResolved, sessionStartedAt, status, transactions]);

  // The credit has been shown: retire the session so a later remount cannot
  // re-baseline before it and report the same top-up all over again. Dropping
  // the cutoff also means `reset()` re-snapshots from the ledger head, so the
  // next cycle only reports top-ups made after this acknowledgement.
  useEffect(() => {
    if (status !== 'credited' || !customerId) {
      return;
    }
    setSessionStartedAt(null);
    void clearWalletFundingSession(customerId);
  }, [customerId, status]);

  // Detect the credit render-phase (mirrors the codebase's "adjust state during
  // render" pattern) so consumers never paint a stale "checking" frame after the
  // credit has already landed. Converges: the guard only fires while
  // status === 'checking', and it immediately transitions out of it. This block
  // is pure — it writes no refs, so an abandoned render leaves nothing behind.
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
    // Never arm without a snapshot: it is only taken once the ledger AND the
    // funding session have resolved. Arming while the wallet query is still
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
