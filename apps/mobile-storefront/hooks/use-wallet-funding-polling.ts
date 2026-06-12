import { useEffect, useRef, useState } from 'react';
import { createLogger } from '@/lib/logger';
import type { WalletOrderFundingIntent } from '@/lib/order-wallet-funding-intent';
import { getOrderWalletFundingIntent } from '@/lib/order-wallet-funding-intent';

const logger = createLogger('WalletFundingPolling');

interface UseWalletFundingPollingArgs {
  enabled: boolean;
  intentId?: string;
  merchantId?: string;
  merchantSlug?: string;
  onCompleted: (intent: WalletOrderFundingIntent) => void;
  onError?: (error: unknown) => void;
  pollIntervalMs: number;
  timeoutMs: number;
}

interface CheckOptions {
  notifyOnError?: boolean;
}

async function fetchIntent({
  intentId,
  merchantId,
  merchantSlug,
}: {
  intentId: string;
  merchantId?: string;
  merchantSlug?: string;
}) {
  const { intent } = await getOrderWalletFundingIntent({
    intentId,
    merchantId,
    merchantSlug,
  });
  return intent;
}

interface DeliverIntentContext {
  completedRef: { current: boolean };
  mountedRef: { current: boolean };
  onCompletedRef: { current: (intent: WalletOrderFundingIntent) => void };
  setIntent: (intent: WalletOrderFundingIntent) => void;
}

function deliverIntent(
  nextIntent: WalletOrderFundingIntent,
  { completedRef, mountedRef, onCompletedRef, setIntent }: DeliverIntentContext
) {
  if (!mountedRef.current) {
    return;
  }
  setIntent(nextIntent);
  if (nextIntent.status !== 'completed' || completedRef.current) {
    return;
  }
  completedRef.current = true;
  onCompletedRef.current(nextIntent);
}

interface PollAttemptContext {
  fetchArgs: { intentId: string; merchantId?: string; merchantSlug?: string };
  inFlightRef: { current: boolean };
  isActive: () => boolean;
  logMessage: string;
  onFetchError?: (error: unknown) => void;
  onIntent: (intent: WalletOrderFundingIntent) => void;
  requestVersionRef: { current: number };
  setIsPolling: (value: boolean) => void;
  setTimedOut: (value: boolean) => void;
}

// Module-scope helper so the try/finally stays outside component scope, where
// it would otherwise block React Compiler memoization of the hook.
async function runPollAttempt({
  fetchArgs,
  inFlightRef,
  isActive,
  logMessage,
  onFetchError,
  onIntent,
  requestVersionRef,
  setIsPolling,
  setTimedOut,
}: PollAttemptContext) {
  const requestVersion = requestVersionRef.current;
  inFlightRef.current = true;
  setIsPolling(true);
  setTimedOut(false);
  try {
    const nextIntent = await fetchIntent(fetchArgs);
    if (!isActive() || requestVersion !== requestVersionRef.current) {
      return;
    }
    onIntent(nextIntent);
  } catch (error) {
    logger.warn(logMessage, { error, ...fetchArgs });
    if (isActive() && requestVersion === requestVersionRef.current) {
      setTimedOut(true);
      onFetchError?.(error);
    }
  } finally {
    if (requestVersion === requestVersionRef.current) {
      inFlightRef.current = false;
      if (isActive()) setIsPolling(false);
    }
  }
}

export function useWalletFundingPolling({
  enabled,
  intentId,
  merchantId,
  merchantSlug,
  onCompleted,
  onError,
  pollIntervalMs,
  timeoutMs,
}: UseWalletFundingPollingArgs) {
  const [intent, setIntent] = useState<WalletOrderFundingIntent | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const completedRef = useRef(false);
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const onCompletedRef = useRef(onCompleted);
  const onErrorRef = useRef(onError);
  const requestVersionRef = useRef(0);
  const [prevRequestKey, setPrevRequestKey] = useState({
    enabled,
    intentId,
    merchantId,
    merchantSlug,
  });

  // Reset visible polling state inline (pre-commit) when the request identity
  // changes, so consumers never see one frame of the previous intent.
  if (
    prevRequestKey.enabled !== enabled ||
    prevRequestKey.intentId !== intentId ||
    prevRequestKey.merchantId !== merchantId ||
    prevRequestKey.merchantSlug !== merchantSlug
  ) {
    setPrevRequestKey({ enabled, intentId, merchantId, merchantSlug });
    setIntent(null);
    setTimedOut(false);
  }

  useEffect(() => {
    onCompletedRef.current = onCompleted;
    onErrorRef.current = onError;
  }, [onCompleted, onError]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset polling bookkeeping whenever the request identity changes.
  useEffect(() => {
    completedRef.current = false;
    inFlightRef.current = false;
    requestVersionRef.current += 1;
  }, [enabled, intentId, merchantId, merchantSlug]);

  const checkNow = async ({ notifyOnError = false }: CheckOptions = {}) => {
    if (!enabled || !intentId || completedRef.current || inFlightRef.current) {
      return;
    }
    await runPollAttempt({
      fetchArgs: { intentId, merchantId, merchantSlug },
      inFlightRef,
      isActive: () => mountedRef.current,
      logMessage: 'Failed to check wallet-funded order status',
      onFetchError: notifyOnError
        ? (error) => onErrorRef.current?.(error)
        : undefined,
      onIntent: (nextIntent) =>
        deliverIntent(nextIntent, {
          completedRef,
          mountedRef,
          onCompletedRef,
          setIntent,
        }),
      requestVersionRef,
      setIsPolling,
      setTimedOut,
    });
  };

  useEffect(() => {
    if (!enabled || !intentId) return;

    let stopped = false;
    const poll = async () => {
      if (
        stopped ||
        completedRef.current ||
        !mountedRef.current ||
        inFlightRef.current
      ) {
        return;
      }
      await runPollAttempt({
        fetchArgs: { intentId, merchantId, merchantSlug },
        inFlightRef,
        isActive: () => !stopped && mountedRef.current,
        logMessage: 'Failed to poll wallet-funded order status',
        onIntent: (nextIntent) =>
          deliverIntent(nextIntent, {
            completedRef,
            mountedRef,
            onCompletedRef,
            setIntent,
          }),
        requestVersionRef,
        setIsPolling,
        setTimedOut,
      });
    };

    void poll();
    const interval = setInterval(poll, pollIntervalMs);
    const timeout = setTimeout(() => {
      clearInterval(interval);
      if (!stopped && !completedRef.current && mountedRef.current) {
        setIsPolling(false);
        setTimedOut(true);
      }
    }, timeoutMs);

    return () => {
      stopped = true;
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [enabled, intentId, merchantId, merchantSlug, pollIntervalMs, timeoutMs]);

  return {
    checkNow,
    intent,
    isPolling,
    timedOut,
  };
}
