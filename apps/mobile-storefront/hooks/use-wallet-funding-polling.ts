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
  const handleIntentRef = useRef<(intent: WalletOrderFundingIntent) => void>(
    () => undefined
  );

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

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset polling state whenever the request identity changes.
  useEffect(() => {
    completedRef.current = false;
    inFlightRef.current = false;
    requestVersionRef.current += 1;
    setIntent(null);
    setTimedOut(false);
  }, [enabled, intentId, merchantId, merchantSlug]);

  handleIntentRef.current = (nextIntent: WalletOrderFundingIntent) => {
    if (!mountedRef.current) {
      return;
    }
    setIntent(nextIntent);
    if (nextIntent.status !== 'completed' || completedRef.current) {
      return;
    }
    completedRef.current = true;
    onCompletedRef.current(nextIntent);
  };

  const checkNow = async ({ notifyOnError = false }: CheckOptions = {}) => {
    if (!enabled || !intentId || completedRef.current || inFlightRef.current) {
      return;
    }
    const requestVersion = requestVersionRef.current;
    inFlightRef.current = true;
    setIsPolling(true);
    setTimedOut(false);
    try {
      const nextIntent = await fetchIntent({
        intentId,
        merchantId,
        merchantSlug,
      });
      if (!mountedRef.current || requestVersion !== requestVersionRef.current) {
        return;
      }
      handleIntentRef.current(nextIntent);
    } catch (error) {
      logger.warn('Failed to check wallet-funded order status', {
        error,
        intentId,
        merchantId,
        merchantSlug,
      });
      if (!mountedRef.current || requestVersion !== requestVersionRef.current) {
        return;
      }
      setTimedOut(true);
      if (notifyOnError) onErrorRef.current?.(error);
    } finally {
      if (requestVersion === requestVersionRef.current) {
        inFlightRef.current = false;
        if (mountedRef.current) setIsPolling(false);
      }
    }
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
      const requestVersion = requestVersionRef.current;
      inFlightRef.current = true;
      setIsPolling(true);
      setTimedOut(false);
      try {
        const nextIntent = await fetchIntent({
          intentId,
          merchantId,
          merchantSlug,
        });
        if (
          stopped ||
          !mountedRef.current ||
          requestVersion !== requestVersionRef.current
        ) {
          return;
        }
        handleIntentRef.current(nextIntent);
      } catch (error) {
        logger.warn('Failed to poll wallet-funded order status', {
          error,
          intentId,
          merchantId,
          merchantSlug,
        });
        if (
          !stopped &&
          mountedRef.current &&
          requestVersion === requestVersionRef.current
        ) {
          setTimedOut(true);
        }
      } finally {
        if (requestVersion === requestVersionRef.current) {
          inFlightRef.current = false;
          if (!stopped && mountedRef.current) setIsPolling(false);
        }
      }
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
