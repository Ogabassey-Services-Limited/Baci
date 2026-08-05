import { createHmac, randomBytes } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { logger } from '@/lib/logger';
import {
  getQuizDeviceHashPepper,
  isProductionDeployment,
} from '@/lib/quiz/quiz-runtime-env';

/**
 * Resolves the device identity used by the per-device attempt cap (QZ041).
 *
 * Two sources, because the two clients have different capabilities:
 *   - MOBILE sends `deviceFingerprint`, a SHA-256 of the native install id.
 *   - WEB has no stable device id, so the server mints a random one and keeps it
 *     in an httpOnly cookie. The value is server-chosen, so a page script cannot
 *     pick it; clearing cookies costs the abuser a fresh browser profile.
 *
 * Whatever the source, the stored value is HMAC'd with a stable pepper before
 * it ever reaches the database. Two reasons:
 *   1. The raw fingerprint is client-supplied. Peppering means an attacker
 *      cannot precompute or collide with another player's stored hash.
 *   2. A device hash is a stable cross-account correlator — sensitive on its own
 *      — so the database never holds a value that can be reversed to the device.
 *
 * Honest limit: neither source is unspoofable. A script can randomise the mobile
 * fingerprint or clear the web cookie. This raises the cost of multi-accounting;
 * it does not close it. Only a scarce verified identity (e.g. SMS) would.
 */

export const QUIZ_DEVICE_COOKIE = 'baci_qdid';

// Long-lived on purpose: a device budget that resets weekly would be pointless.
const QUIZ_DEVICE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export interface ResolvedQuizDevice {
  /** SHA-256 hex, ready for `bind_quiz_attempt_device`. Null when unavailable. */
  deviceHash: string | null;
  /** Present when a new web device cookie must be written on the response. */
  cookieToSet?: {
    name: string;
    value: string;
    httpOnly: true;
    sameSite: 'lax';
    secure: boolean;
    path: '/';
    maxAge: number;
  };
}

function hashDeviceIdentity(rawIdentity: string): string | null {
  let pepper: string | undefined;
  try {
    pepper = getQuizDeviceHashPepper();
  } catch (error) {
    logger.error({
      error,
      event: 'quiz_device_cap_degraded',
      message: 'Quiz device hash pepper lookup failed',
    });
    return null;
  }

  // Fail SOFT, not closed: without the pepper we cannot hash, and storing an
  // unpeppered client value would be worse than storing nothing. The player
  // still plays — the per-customer and email-identity caps still bound them.
  if (!pepper) {
    logger.warn({
      event: 'quiz_device_cap_degraded',
      message: 'Quiz device hash pepper is unavailable',
    });
    return null;
  }

  return createHmac('sha256', pepper).update(rawIdentity).digest('hex');
}

export function resolveQuizDevice(
  request: NextRequest,
  clientFingerprint?: string
): ResolvedQuizDevice {
  // Mobile: trust the shape (the schema already pinned it to SHA-256 hex), then
  // pepper it. We never store what the client sent verbatim.
  if (clientFingerprint) {
    return { deviceHash: hashDeviceIdentity(`native:${clientFingerprint}`) };
  }

  // Web: reuse the existing cookie, or mint one. Optional-chained because the
  // cookie jar is not guaranteed on every request shape this route can receive
  // — and an abuse control must never be the thing that 500s a legitimate start.
  const existing = request.cookies?.get(QUIZ_DEVICE_COOKIE)?.value?.trim();
  if (existing) {
    return { deviceHash: hashDeviceIdentity(`web:${existing}`) };
  }

  const minted = randomBytes(32).toString('hex');

  return {
    deviceHash: hashDeviceIdentity(`web:${minted}`),
    cookieToSet: {
      name: QUIZ_DEVICE_COOKIE,
      value: minted,
      httpOnly: true,
      sameSite: 'lax',
      secure: isProductionDeployment(),
      path: '/',
      maxAge: QUIZ_DEVICE_COOKIE_MAX_AGE_SECONDS,
    },
  };
}
