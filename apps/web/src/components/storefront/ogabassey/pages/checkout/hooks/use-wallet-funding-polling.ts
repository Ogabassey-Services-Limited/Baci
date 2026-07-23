'use client';

import { useEffect, useRef, useState } from 'react';
import { getOrderWalletFundingIntent } from '@/lib/order-wallet-funding-intent-client';
import { isTerminalWalletFundingIntentStatus } from '@/lib/order-wallet-funding-intent-status';
import type { WalletOrderFundingIntent } from '@/schemas/order-wallet-funding-intent';

export const WALLET_FUNDING_POLL_INTERVAL_MS = 5000;

interface UseWalletFundingPollingArgs {
  enabled: boolean;
  intentId: string | undefined;
  merchantId: string | undefined;
  merchantSlug: string | undefined;
  /** Fired at most once, only when the intent reaches `completed`. */
  onCompleted: (intent: WalletOrderFundingIntent) => void;
  pollIntervalMs?: number;
}

interface PollAttemptContext {
  completedRef: { current: boolean };
  fetchArgs: { intentId: string; merchantId?: string; merchantSlug?: string };
  inFlightRef: { current: boolean };
  isActive: () => boolean;
  onCompletedRef: { current: (intent: WalletOrderFundingIntent) => void };
  setError: (message: string | null) => void;
  setIntent: (intent: WalletOrderFundingIntent) => void;
  setIsChecking: (value: boolean) => void;
}

// Module scope so the try/finally stays out of the component body, where it
// would otherwise block React Compiler memoization of the hook (same trick as
// the mobile reference hook).
async function runPollAttempt({
  completedRef,
  fetchArgs,
  inFlightRef,
  isActive,
  onCompletedRef,
  setError,
  setIntent,
  setIsChecking,
}: PollAttemptContext) {
  inFlightRef.current = true;
  setIsChecking(true);
  try {
    const nextIntent = await getOrderWalletFundingIntent(fetchArgs);
    if (!isActive()) {
      return;
    }
    setError(null);
    setIntent(nextIntent);
    if (nextIntent.status === 'completed' && !completedRef.current) {
      completedRef.current = true;
      onCompletedRef.current(nextIntent);
    }
  } catch (error) {
    if (isActive()) {
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to check transfer status'
      );
    }
  } finally {
    inFlightRef.current = false;
    if (isActive()) {
      setIsChecking(false);
    }
  }
}

/**
 * Polls one order wallet-funding intent until it reaches a terminal status.
 * `underfunded` is NOT terminal, so a partial transfer keeps polling while the
 * customer tops it up. Never claims payment: only a `completed` status calls
 * `onCompleted`.
 */
export function useWalletFundingPolling({
  enabled,
  intentId,
  merchantId,
  merchantSlug,
  onCompleted,
  pollIntervalMs = WALLET_FUNDING_POLL_INTERVAL_MS,
}: UseWalletFundingPollingArgs) {
  const [intent, setIntent] = useState<WalletOrderFundingIntent | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const completedRef = useRef(false);
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const onCompletedRef = useRef(onCompleted);
  const [prevIntentId, setPrevIntentId] = useState(intentId);

  // Render-phase reset so consumers never read the previous intent's status for
  // a frame after a new intent opens. React "adjusting state during render".
  if (prevIntentId !== intentId) {
    setPrevIntentId(intentId);
    setIntent(null);
    setError(null);
  }

  useEffect(() => {
    onCompletedRef.current = onCompleted;
  }, [onCompleted]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: bookkeeping resets whenever the polled intent changes.
  useEffect(() => {
    completedRef.current = false;
    inFlightRef.current = false;
  }, [intentId]);

  const status = intent?.status;
  const stopped = status ? isTerminalWalletFundingIntentStatus(status) : false;

  useEffect(() => {
    if (!enabled || !intentId || stopped) {
      return;
    }

    let cancelled = false;
    const poll = () => {
      if (cancelled || inFlightRef.current || !mountedRef.current) {
        return;
      }
      void runPollAttempt({
        completedRef,
        fetchArgs: { intentId, merchantId, merchantSlug },
        inFlightRef,
        isActive: () => !cancelled && mountedRef.current,
        onCompletedRef,
        setError,
        setIntent,
        setIsChecking,
      });
    };

    poll();
    const interval = setInterval(poll, pollIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [enabled, intentId, merchantId, merchantSlug, pollIntervalMs, stopped]);

  const checkNow = () => {
    if (!(enabled && intentId) || stopped || inFlightRef.current) {
      return;
    }
    void runPollAttempt({
      completedRef,
      fetchArgs: { intentId, merchantId, merchantSlug },
      inFlightRef,
      isActive: () => mountedRef.current,
      onCompletedRef,
      setError,
      setIntent,
      setIsChecking,
    });
  };

  return { checkNow, error, intent, isChecking };
}
