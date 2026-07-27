import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  getStorefrontCacheActuatorRequestBodySha256,
  verifyStorefrontCacheActuatorRequest,
} from './storefront-cache-actuator-auth';

const secret = 'cache-actuator-test-secret';
const rawBody = '{"schemaVersion":1}';
const timestamp = '1720000000';

function signatureFor(raw: string, signedTimestamp = timestamp): string {
  const digest = getStorefrontCacheActuatorRequestBodySha256(raw);
  return `v1=${createHmac('sha256', secret)
    .update(`${signedTimestamp}\n${digest}`, 'utf8')
    .digest('hex')}`;
}

describe('verifyStorefrontCacheActuatorRequest', () => {
  it('accepts the exact raw-body digest bound to a fresh timestamp', () => {
    expect(
      verifyStorefrontCacheActuatorRequest({
        nowMs: 1_720_000_030_000,
        rawBody,
        secret,
        signatureHeader: signatureFor(rawBody),
        timestampHeader: timestamp,
      })
    ).toEqual({
      ok: true,
      requestBodySha256: getStorefrontCacheActuatorRequestBodySha256(rawBody),
    });
  });

  it('rejects malformed signatures, stale timestamps, and changed raw bytes', () => {
    for (const input of [
      {
        rawBody,
        signatureHeader: `v1=${'A'.repeat(64)}`,
        timestampHeader: timestamp,
      },
      {
        rawBody,
        signatureHeader: signatureFor(rawBody),
        timestampHeader: '1720000061',
      },
      {
        rawBody: `${rawBody} `,
        signatureHeader: signatureFor(rawBody),
        timestampHeader: timestamp,
      },
    ]) {
      expect(
        verifyStorefrontCacheActuatorRequest({
          ...input,
          nowMs: 1_720_000_000_000,
          secret,
        }).ok
      ).toBe(false);
    }
  });
});
