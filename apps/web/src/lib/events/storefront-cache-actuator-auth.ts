import 'server-only';

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const MAX_SIGNATURE_SKEW_SECONDS = 60;
const SIGNATURE_PATTERN = /^v1=[a-f0-9]{64}$/;
const UNIX_SECONDS_PATTERN = /^(?:0|[1-9][0-9]*)$/;

export type StorefrontCacheActuatorAuthResult =
  | { ok: true; requestBodySha256: string }
  | { ok: false };

/** Server-only accessor kept separate so the route itself has no env reach. */
export function getStorefrontCacheActuatorSecret(): string | undefined {
  const secret = process.env.STOREFRONT_CACHE_ACTUATOR_SECRET?.trim();
  return secret || undefined;
}

/** Server-only accessor for the fixed, single-merchant canary boundary. */
export function getStorefrontCacheCanaryMerchantId(): string | undefined {
  const merchantId = process.env.STOREFRONT_CACHE_CANARY_MERCHANT_ID?.trim();
  return merchantId || undefined;
}

export function getStorefrontCacheActuatorRequestBodySha256(
  rawBody: string
): string {
  return createHash('sha256').update(rawBody, 'utf8').digest('hex');
}

/**
 * Validate the exact raw bytes before JSON parsing. Replays within the small
 * timestamp window remain valid because every downstream barrier stage is
 * intentionally idempotent.
 */
export function verifyStorefrontCacheActuatorRequest({
  nowMs = Date.now(),
  rawBody,
  secret,
  signatureHeader,
  timestampHeader,
}: {
  nowMs?: number;
  rawBody: string;
  secret: string | undefined;
  signatureHeader: string | null;
  timestampHeader: string | null;
}): StorefrontCacheActuatorAuthResult {
  if (
    !secret ||
    !signatureHeader ||
    !timestampHeader ||
    !SIGNATURE_PATTERN.test(signatureHeader) ||
    !UNIX_SECONDS_PATTERN.test(timestampHeader)
  ) {
    return { ok: false };
  }

  const timestampSeconds = Number(timestampHeader);
  if (
    !Number.isSafeInteger(timestampSeconds) ||
    Math.abs(Math.floor(nowMs / 1000) - timestampSeconds) >
      MAX_SIGNATURE_SKEW_SECONDS
  ) {
    return { ok: false };
  }

  const requestBodySha256 =
    getStorefrontCacheActuatorRequestBodySha256(rawBody);
  const expected = createHmac('sha256', secret)
    .update(`${timestampHeader}\n${requestBodySha256}`, 'utf8')
    .digest();
  const supplied = Buffer.from(signatureHeader.slice('v1='.length), 'hex');

  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  ) {
    return { ok: false };
  }

  return { ok: true, requestBodySha256 };
}
