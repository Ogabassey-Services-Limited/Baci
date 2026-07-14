import { useAuthStore } from '@/stores/auth-store';

/**
 * Cap on how long a caller waits for auth to hydrate. Generous enough for a
 * cold start from a notification tap (session restore + customer lookup), short
 * enough that a stuck auth store cannot pin a pending resume forever.
 */
const AUTH_HYDRATION_TIMEOUT_MS = 8000;

/**
 * The customer signed in RIGHT NOW, awaiting auth hydration if needed.
 *
 * Notification taps can arrive before the auth store has initialised — a cold
 * start FROM the notification is exactly that case. Reading `customer` eagerly
 * would then yield `undefined`, and a customer-scoped consumer (the wallet
 * funding intent) would treat a perfectly legitimate intent as ownerless and
 * bin it. So callers on the tap path resolve identity through here instead.
 *
 * Resolves `undefined` when nobody is signed in, or if hydration does not
 * settle in time — both mean "cannot attribute this to a customer", which every
 * caller must treat as "do nothing".
 */
export function resolveActiveCustomerId(): Promise<string | undefined> {
  const state = useAuthStore.getState();
  if (state.isInitialized) {
    return Promise.resolve(state.customer?.id);
  }

  return new Promise<string | undefined>((resolve) => {
    let unsubscribe: (() => void) | undefined;
    let settled = false;

    const settle = (customerId: string | undefined) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      unsubscribe?.();
      resolve(customerId);
    };

    const timeout = setTimeout(() => {
      settle(undefined);
    }, AUTH_HYDRATION_TIMEOUT_MS);

    unsubscribe = useAuthStore.subscribe((next) => {
      if (next.isInitialized) {
        settle(next.customer?.id);
      }
    });

    // Re-check after subscribing: initialisation can land between the eager
    // read above and the subscription, and that update would never be observed.
    if (useAuthStore.getState().isInitialized) {
      settle(useAuthStore.getState().customer?.id);
    }
  });
}
