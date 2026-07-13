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
 */
export function useWalletCreditWatch({
  balance,
  refetch,
  returnTo,
}: UseWalletCreditWatchArgs): WalletCreditWatch {
  const [status, setStatus] = useState<WalletCreditWatchStatus>('idle');
  const [creditedAmount, setCreditedAmount] = useState<number | null>(null);
  const baselineRef = useRef<number | null>(null);
  const refetchRef = useRef(refetch);

  useEffect(() => {
    refetchRef.current = refetch;
  }, [refetch]);

  // Detect the credit render-phase (mirrors the codebase's "adjust state during
  // render" pattern) so consumers never paint a stale "checking" frame after
  // the balance has already grown. Converges: the guard only fires while
  // status === 'checking', and it immediately transitions out of it.
  if (
    status === 'checking' &&
    baselineRef.current !== null &&
    typeof balance === 'number' &&
    Number.isFinite(balance) &&
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
    // Never arm without a real baseline: arming while the balance is still
    // loading would record 0 and false-positive "credited" (with a bogus
    // amount) the moment the actual balance arrives.
    if (!isFiniteBalance(balance)) {
      return;
    }
    baselineRef.current = balance;
    setCreditedAmount(null);
    setStatus('checking');
    void refetchRef.current();
  };

  return {
    armCheck,
    creditedAmount,
    returnCtaHref: status === 'credited' ? returnTo : undefined,
    status,
  };
}
