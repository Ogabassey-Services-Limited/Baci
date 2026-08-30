import type { Session } from '@supabase/supabase-js';
import { createLogger } from '@/lib/logger';

const log = createLogger('Order');
const CHECKOUT_SESSION_TIMEOUT_MS = 5_000;

type CheckoutSessionAuth = {
  getSession: () => Promise<{
    data: { session: Session | null };
  }>;
};

export async function getCheckoutStoredSession(
  auth: CheckoutSessionAuth,
  timeoutMs = CHECKOUT_SESSION_TIMEOUT_MS
): Promise<Session | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error('Checkout session read timed out')),
      timeoutMs
    );
  });

  try {
    const { data } = await Promise.race([auth.getSession(), timeout]);
    return data.session;
  } catch (error) {
    log.warn(
      'Unable to read checkout session within timeout; using guest checkout',
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    );
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
