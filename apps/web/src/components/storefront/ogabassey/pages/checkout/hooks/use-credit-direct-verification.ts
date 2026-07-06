import { useEffect, useState } from 'react';

const DEFAULT_POLL_INTERVAL_MS = 5_000;
const DEFAULT_TIMEOUT_MS = 150_000;
const CONFIRMED_PAYMENT_STATUSES = new Set(['paid', 'bnpl_approved']);
const CANCELLED_PAYMENT_STATUSES = new Set(['cancelled', 'refunded']);

export type CreditDirectVerificationPhase =
  | 'idle'
  | 'polling'
  | 'confirmed'
  | 'cancelled'
  | 'timeout';

interface UseCreditDirectVerificationOptions {
  active: boolean;
  orderId: string | null;
  merchantSlug: string;
  trackingToken: string | null;
  lookupEmail: string | null;
  pollIntervalMs?: number;
  timeoutMs?: number;
}

interface OrderStatusResponse {
  payment_status?: string | null;
}

/**
 * Polls the storefront order endpoint while a Credit Direct checkout attempt
 * is pending confirmation. Credit Direct's SDK offers no redirect URL or
 * status API, so once its hosted popup replaces the launcher page the only
 * way to detect completion is watching the order's payment_status flip to
 * bnpl_approved/paid via the provider webhook.
 */
export function useCreditDirectVerification({
  active,
  orderId,
  merchantSlug,
  trackingToken,
  lookupEmail,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: UseCreditDirectVerificationOptions) {
  const [phase, setPhase] = useState<CreditDirectVerificationPhase>('idle');
  const [pollEpoch, setPollEpoch] = useState(0);

  useEffect(() => {
    if (!active || !orderId) {
      setPhase('idle');
      return;
    }

    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const controller = new AbortController();
    setPhase('polling');

    const query = new URLSearchParams({ merchant_slug: merchantSlug });
    if (trackingToken) query.set('token', trackingToken);
    if (lookupEmail) query.set('email', lookupEmail);
    const orderUrl = `/api/storefront/orders/${orderId}?${query.toString()}`;
    const startedAt = Date.now();

    const checkOnce = async () => {
      try {
        const response = await fetch(orderUrl, {
          signal: controller.signal,
        });
        if (response.ok) {
          const order = (await response.json()) as OrderStatusResponse;
          const paymentStatus = order.payment_status || '';
          if (CONFIRMED_PAYMENT_STATUSES.has(paymentStatus)) {
            if (!disposed) setPhase('confirmed');
            return;
          }
          if (CANCELLED_PAYMENT_STATUSES.has(paymentStatus)) {
            if (!disposed) setPhase('cancelled');
            return;
          }
        }
      } catch {
        // Transient network failure — keep polling until the deadline.
      }

      if (disposed) return;
      if (Date.now() - startedAt >= timeoutMs) {
        setPhase('timeout');
        return;
      }
      timer = setTimeout(() => {
        void checkOnce();
      }, pollIntervalMs);
    };

    void checkOnce();

    return () => {
      disposed = true;
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [
    active,
    orderId,
    merchantSlug,
    trackingToken,
    lookupEmail,
    pollIntervalMs,
    timeoutMs,
    pollEpoch,
  ]);

  const restart = () => setPollEpoch((epoch) => epoch + 1);

  return { phase, restart };
}
