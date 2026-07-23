import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  WALLET_FUNDING_CHECKING_STATE_ENABLED,
  WALLET_FUNDING_POLLING,
} from '@/constants/wallet-funding';
import type { WalletReturnHref } from '@/lib/sanitize-wallet-return-to';
import {
  clearWalletFundingSession,
  type WalletLedgerPosition,
} from '@/lib/wallet-funding-session';
import { resolveWalletCreditBaseline } from './resolve-wallet-credit-baseline';
import {
  findLatestWalletTopUpCredit,
  isNewWalletTopUpCredit,
  type WalletTopUpCandidate,
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
  /** Gate used while a route-level funding-session write is still in flight. */
  canResolveBaseline?: boolean;
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
 * Detection is ledger-based, not balance-delta-based, and its baseline is a
 * ledger POSITION, not a wall-clock time:
 *   1. Customers usually transfer BEFORE tapping "I've transferred", so the
 *      credit can land while they are away in their bank app — and the wallet
 *      screen is frequently backgrounded or KILLED while they are there. The
 *      baseline is therefore the newest top-up row that existed at the moment of
 *      intent, persisted with the bank-transfer funding session
 *      (`lib/wallet-funding-session`, captured by
 *      `resolve-wallet-credit-baseline`). "New" then means a top-up row whose
 *      SERVER `created_at` is strictly after that row's SERVER `created_at` — the
 *      device clock is never compared with server time, so a phone running behind
 *      the server cannot make a pre-intent top-up read as new. With no session
 *      (no customer yet, expired, unreadable) it falls back to the ledger head
 *      seen while idle, which is still correct for a customer who never left the
 *      mounted screen and can only under-report otherwise.
 *   2. A balance snapshot cannot tell a bank transfer from cashback, a refund,
 *      an order reversal, or a savings move — all of which raise the spendable
 *      balance and would false-positive "Wallet credited". Only rows with
 *      `source_type = 'wallet_topup'` are funding credits, and the credited
 *      amount is read straight off that row.
 *
 * KNOWN RESIDUAL: `wallet_topup` is written for CARD funding too, so a card
 * top-up completed inside a genuine bank-transfer intent window is announced as
 * "credited". The wallet really was funded and the return-to-purchase CTA is
 * valid, so this is a naming imprecision, not a false credit. Discriminating the
 * two needs a server-side provenance field on the ledger row.
 */
export function useWalletCreditWatch({
  canResolveBaseline = true,
  customerId,
  refetch,
  returnTo,
  transactions,
}: UseWalletCreditWatchArgs): WalletCreditWatch {
  const [status, setStatus] = useState<WalletCreditWatchStatus>('idle');
  const [creditedAmount, setCreditedAmount] = useState<number | null>(null);
  const baselineRef = useRef<WalletLedgerPosition | null>(null);
  const idleBaselineRef = useRef<WalletLedgerPosition | null>(null);
  const hasIdleBaselineRef = useRef(false);
  const baselineRequestRef = useRef(0);
  const refetchRef = useRef(refetch);
  // The in-flight "retire the session" write, if any. The next baseline
  // resolution chains on it so it can never read back the session that the
  // acknowledged credit just retired — reading a stale anchor there would
  // re-announce the SAME credit on the next arm.
  const sessionRetirementRef = useRef<Promise<void> | null>(null);

  const [prevCustomerId, setPrevCustomerId] = useState(customerId);
  const isCustomerChanging = prevCustomerId !== customerId;
  if (isCustomerChanging) {
    // Account switch / auth hydration: discard the other customer's watch.
    // Render-phase state adjustment (the codebase's derive pattern); no refs are
    // written here, so an abandoned render leaves nothing behind.
    //
    // Re-resolving the baseline alone is NOT enough. An in-flight watch carries
    // `status`, `creditedAmount` and (in refs, cleared in the layout effect
    // below) the previous customer's ledger baselines. Left alone, the very next
    // render would compare the NEW customer's ledger against the OLD customer's
    // baseline — announcing a credit that belongs to someone else and leaking
    // their amount, and clearing the new customer's funding session on the way.
    // The whole watch resets; the customer re-arms it themselves.
    setPrevCustomerId(customerId);
    setStatus('idle');
    setCreditedAmount(null);
  }

  useEffect(() => {
    refetchRef.current = refetch;
  }, [refetch]);

  // Customer hydration/switch invalidates any baseline resolved for the prior
  // identity. Commit-phase invalidation also cancels in-flight resolutions.
  // biome-ignore lint/correctness/useExhaustiveDependencies: customerId is the trigger, not a read value — the effect exists to re-run on a customer change
  useLayoutEffect(() => {
    baselineRef.current = null;
    hasIdleBaselineRef.current = false;
    idleBaselineRef.current = null;
    baselineRequestRef.current += 1;
    sessionRetirementRef.current = null;
  }, [customerId]);

  // A fresh route intent closes the gate while its persisted session is being
  // written. Invalidate the previous intent's resolved baseline immediately so
  // the later false→true transition must resolve the new session instead of
  // reusing an old anchor.
  useLayoutEffect(() => {
    if (canResolveBaseline) {
      return;
    }
    baselineRef.current = null;
    hasIdleBaselineRef.current = false;
    idleBaselineRef.current = null;
    baselineRequestRef.current += 1;
  }, [canResolveBaseline]);

  // Resolve the pre-transfer ledger position: the newest top-up credit that
  // already existed when the customer expressed bank-transfer intent (or, with
  // no session, the ledger head while idle). This MUST NOT run during render —
  // a ref write survives an abandoned concurrent render, so a render that never
  // commits could latch a baseline against a ledger the customer never saw, and
  // `armCheck` would then measure from that phantom. An effect only runs for a
  // COMMITTED render. `undefined` transactions mean the query is still loading:
  // resolving then would treat the customer's existing top-up history as new.
  useEffect(() => {
    if (
      !canResolveBaseline ||
      status !== 'idle' ||
      !transactions ||
      hasIdleBaselineRef.current
    ) {
      return;
    }
    const head = findLatestWalletTopUpCredit(transactions);
    // Narrowed to the position: the amount belongs to the credit being
    // announced, never to the baseline, and must not reach storage.
    const ledgerHead: WalletLedgerPosition | null = head
      ? { createdAt: head.createdAt, id: head.id }
      : null;
    if (!customerId) {
      // No customer to scope a session to — the ledger head is the only sound
      // baseline (and a later customerId will re-resolve, see above).
      hasIdleBaselineRef.current = true;
      idleBaselineRef.current = ledgerHead;
      return;
    }
    baselineRequestRef.current += 1;
    const requestId = baselineRequestRef.current;
    let isActive = true;
    // Ordered strictly after any in-flight retirement of an acknowledged
    // session. `resolveWalletCreditBaseline` never rejects; the `catch` is
    // belt-and-braces — leaving the baseline unresolved keeps `armCheck` a
    // no-op, which can only time out, never credit.
    void (sessionRetirementRef.current ?? Promise.resolve())
      .catch(() => undefined)
      .then(() => resolveWalletCreditBaseline(customerId, ledgerHead))
      .then((baseline) => {
        if (!isActive || requestId !== baselineRequestRef.current) {
          return;
        }
        idleBaselineRef.current = baseline;
        hasIdleBaselineRef.current = true;
      })
      .catch(() => undefined);
    return () => {
      isActive = false;
    };
  }, [canResolveBaseline, customerId, status, transactions]);

  // The credit has been shown: retire the session so a later remount cannot
  // re-anchor before it and report the same top-up all over again.
  useEffect(() => {
    if (status !== 'credited' || !customerId) {
      return;
    }
    sessionRetirementRef.current = clearWalletFundingSession(customerId);
  }, [customerId, status]);

  // Detect the credit render-phase (mirrors the codebase's "adjust state during
  // render" pattern) so consumers never paint a stale "checking" frame after the
  // credit has already landed. Converges: the guard only fires while
  // status === 'checking', and it immediately transitions out of it. This block
  // is pure — it writes no refs, so an abandoned render leaves nothing behind.
  //
  // Skipped on the render that observes a customer change: `status` still holds
  // the previous customer's value on that pass (the reset above only takes
  // effect on the immediate re-render) and `baselineRef` still holds their
  // ledger position, so comparing here could credit the new customer with the
  // old one's top-up.
  if (!isCustomerChanging && status === 'checking') {
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
    // Never arm until both the ledger and funding session have resolved.
    if (!canResolveBaseline || !hasIdleBaselineRef.current) {
      return;
    }
    baselineRef.current = idleBaselineRef.current;
    setCreditedAmount(null);
    setStatus('checking');
    void refetchRef.current();
  };

  const reset = () => {
    // NO new funding session is minted here — deliberately, and this is the fix
    // for a PROVEN false credit (it previously re-anchored "at now" so a second
    // transfer from this mount would survive an app kill; codex thread #2).
    // Tapping "Done" expresses NO funding intent, and a card top-up writes the
    // SAME `source_type = 'wallet_topup'` as a bank transfer. Any marker minted
    // here therefore sits strictly BEFORE an unrelated card top-up, and a routine
    // remount + a tap of "I've transferred" would announce "Wallet credited ₦X"
    // for money that was never transferred.
    //
    // The cost of refusing: after acknowledging a credit, a further transfer is
    // detected only while this screen stays mounted (the re-resolved ledger-head
    // baseline below covers exactly that). If the app is killed first, the
    // customer sees a TIMEOUT and taps "Check again" — their balance is correct
    // either way. A timeout is an acceptable harm; a false credit is not.
    baselineRef.current = null;
    // Re-resolve on the next idle render so the following cycle only reports
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
