import type { Session, SupportedStorage } from '@supabase/supabase-js';
import { createLogger } from '@/lib/logger';

const log = createLogger('Order');
const CHECKOUT_SESSION_TIMEOUT_MS = 5_000;

function parseStoredSession(value: string | null): Session | null {
  if (!value) return null;
  try {
    const session = JSON.parse(value) as Partial<Session>;
    return session.access_token && session.refresh_token && session.user?.id
      ? (session as Session)
      : null;
  } catch {
    return null;
  }
}

export async function getCheckoutStoredSession(
  storage: Pick<SupportedStorage, 'getItem'> | undefined,
  storageKey: string,
  timeoutMs = CHECKOUT_SESSION_TIMEOUT_MS
): Promise<Session | null> {
  if (!storage || !storageKey) return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error('Checkout session read timed out')),
      timeoutMs
    );
  });

  try {
    const value = await Promise.race([storage.getItem(storageKey), timeout]);
    return parseStoredSession(value);
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
