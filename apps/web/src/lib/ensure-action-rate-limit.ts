import { cookies, headers } from 'next/headers';
import { checkRateLimit } from '@/ai/provider';
import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';

/**
 * Abuse guard for public / pre-auth server actions.
 *
 * Binds the rate-limit counter to the authenticated user id when a session
 * exists, otherwise to the platform-provided client IP. This is an identity
 * binding for counting purposes, NOT a login gate — public actions stay
 * anonymous.
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
      // IP resolution order (per Vercel request-header docs):
      // 1. x-vercel-forwarded-for / x-real-ip are platform-set with the real
      //    client IP and cannot be spoofed; on Vercel one of these always
      //    exists, so the x-forwarded-for branch never runs in production.
      // 2. The x-forwarded-for fallback (non-Vercel/dev only) deliberately
      //    takes the LAST hop, not the first: the leftmost entry is
      //    client-supplied and trivially spoofable, which would let attackers
      //    mint a fresh identity per request and bypass the limiter entirely.
      //    Worst case for .at(-1) is several clients behind one proxy sharing
      //    a bucket (fail-closed); .at(0) fails open. Do not "fix" this back.
      identity =
        headerStore.get('x-vercel-forwarded-for')?.trim() ||
        headerStore.get('x-real-ip')?.trim() ||
        headerStore
          .get('x-forwarded-for')
          ?.split(',')
          .map((ip) => ip.trim())
          .filter(Boolean)
          .at(-1) ||
        'unknown';
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
