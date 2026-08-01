import { describe, expect, it } from 'vitest';
import {
  PointerCacheSchema,
  PurgeContractSchema,
} from './cloudflare-evidence-qualification-schemas';

describe('cloudflare evidence qualification schemas', () => {
  it('rejects pointer-cache hashes that are not canonical SHA-256 values', () => {
    expect(
      PointerCacheSchema.safeParse({
        cacheRuleId: 'rule',
        cacheRulesetVersion: 'version',
        traceExpressionSha256: 'bad',
        acceptedCfCacheStatuses: ['DYNAMIC'],
        requestCacheMode: 'no-store',
        repeatedProbeCount: 2,
        ageObserved: false,
        hitObserved: false,
        missObserved: false,
        qualifiedAt: '2026-07-31T00:00:00.000Z',
        expiresAt: '2026-08-01T00:00:00.000Z',
        canonicalSha256: 'a'.repeat(64),
      }).success
    ).toBe(false);
  });

  it('requires a zone-scoped purge endpoint', () => {
    expect(
      PurgeContractSchema.safeParse({
        endpoint: '/accounts/account/purge_cache',
        requestSchemaSha256: 'a'.repeat(64),
        rateLimitFingerprint: 'b'.repeat(64),
        policySha256: 'c'.repeat(64),
        productionResourceState: 'present_verified',
      }).success
    ).toBe(false);
  });
});
