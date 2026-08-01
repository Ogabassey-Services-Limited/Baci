import { describe, expect, it } from 'vitest';
import {
  PointerCacheSchema,
  PurgeContractSchema,
  QUALIFICATION_EVIDENCE_HOST,
  QUALIFICATION_POINTER_URL,
  ReviewedQualificationArtifactSchema,
} from './cloudflare-evidence-qualification-schemas';
import {
  readback,
  reviewedArtifacts,
} from './qualify-cloudflare-evidence-sources.test-fixtures';

describe('cloudflare evidence qualification schemas', () => {
  it('derives the pointer URL from the shared evidence host', () => {
    expect(QUALIFICATION_POINTER_URL).toBe(
      `https://${QUALIFICATION_EVIDENCE_HOST}/__baci-evidence/a`
    );
  });

  it('accepts a canonical pointer-cache receipt and zone-scoped purge contract', () => {
    expect(PointerCacheSchema.safeParse(readback.pointerCache).success).toBe(
      true
    );
    expect(
      PurgeContractSchema.safeParse({
        endpoint: '/zones/zone/purge_cache',
        requestSchemaSha256: 'a'.repeat(64),
        rateLimitFingerprint: 'b'.repeat(64),
        policySha256: 'c'.repeat(64),
        productionResourceState: 'present_verified',
      }).success
    ).toBe(true);
  });

  it('rejects pointer-cache hashes that are not canonical SHA-256 values', () => {
    const parsed = PointerCacheSchema.safeParse({
      pointerUrl: QUALIFICATION_POINTER_URL,
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
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) throw new Error('expected invalid pointer-cache hash');
    expect(parsed.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: ['traceExpressionSha256'] }),
      ])
    );
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

  it('rejects BYPASS as pointer-cache proof', () => {
    expect(
      PointerCacheSchema.safeParse({
        pointerUrl: QUALIFICATION_POINTER_URL,
        cacheRuleId: 'rule',
        cacheRulesetVersion: 'version',
        traceExpressionSha256: 'a'.repeat(64),
        acceptedCfCacheStatuses: ['BYPASS'],
        requestCacheMode: 'no-store',
        repeatedProbeCount: 2,
        ageObserved: false,
        hitObserved: false,
        missObserved: false,
        qualifiedAt: '2026-07-31T00:00:00.000Z',
        expiresAt: '2026-08-01T00:00:00.000Z',
        canonicalSha256: 'b'.repeat(64),
      }).success
    ).toBe(false);
  });

  it.each([
    ['bundleSha256', 'scriptEtag'],
    ['moduleListSha256', 'moduleSha256'],
    ['configSha256', 'settingsSha256'],
  ] as const)('binds nested %s to top-level %s', (nestedField) => {
    const artifact = reviewedArtifacts[0];
    const mismatched = {
      ...artifact,
      artifactReceipt: {
        ...artifact.artifactReceipt,
        [nestedField]: '0'.repeat(64),
      },
    };

    expect(
      ReviewedQualificationArtifactSchema.safeParse(mismatched).success
    ).toBe(false);
  });
});
