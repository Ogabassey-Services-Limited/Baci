import { cookies, headers } from 'next/headers';
import { checkRateLimit } from '@/ai/provider';
import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';

/**
 * Abuse guard for public / pre-auth server actions.
 *
 * Binds the rate-limit counter to the authenticated user id when a session
 * exists, otherwise to the client IP (first hop of `x-forwarded-for`). This is
 * an identity binding for counting purposes, NOT a login gate — public actions
 * stay anonymous.
 *
 * Counting backend: in-memory sliding window (`checkRateLimit` from
 * `@/ai/provider`). LIMITATION: per-instance memory resets on serverless cold
 * starts; for stricter enforcement migrate to Upstash Redis sliding-window
 * counters mirroring `@/lib/rate-limit` (`getRedis()` + `@upstash/ratelimit`).
 *
 * @returns true when the call is allowed, false when rate limited.
 */
export async function ensureActionRateLimit(
  action: string,
  config: { requests: number; windowMs: number }
): Promise<boolean> {
  let identity: string | null = null;

  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    identity = user?.id ?? null;
  } catch (error) {
    logger.warn({
      message: 'ensureActionRateLimit: session lookup failed',
      action,
      error,
    });
  }

  if (!identity) {
    try {
      const headerStore = await headers();
      const forwardedFor = headerStore.get('x-forwarded-for');
      identity = forwardedFor?.split(',')[0]?.trim() || 'unknown';
    } catch {
      identity = 'unknown';
    }
  }

  const { allowed } = checkRateLimit(`action:${action}:${identity}`, config);

  if (!allowed) {
    logger.warn({
      message: 'ensureActionRateLimit: rate limit exceeded',
      action,
    });
  }

  return allowed;
}
