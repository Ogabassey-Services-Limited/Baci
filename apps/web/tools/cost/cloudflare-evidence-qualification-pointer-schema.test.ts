import { describe, expect, it } from 'vitest';
import {
  PointerCacheSchema,
  PurgeContractSchema,
  QUALIFICATION_EVIDENCE_HOST,
  QUALIFICATION_POINTER_URL,
} from './cloudflare-evidence-qualification-schemas';
import { readback } from './qualify-cloudflare-evidence-sources.test-fixtures';

describe('Cloudflare pointer-cache qualification schemas', () => {
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
      ...readback.pointerCache,
      traceExpressionSha256: 'bad',
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) throw new Error('expected invalid pointer-cache hash');
    expect(parsed.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: ['traceExpressionSha256'] }),
      ])
    );
  });

  it('rejects account-scoped purge endpoints and BYPASS cache evidence', () => {
    expect(
      PurgeContractSchema.safeParse({
        endpoint: '/accounts/account/purge_cache',
        requestSchemaSha256: 'a'.repeat(64),
        rateLimitFingerprint: 'b'.repeat(64),
        policySha256: 'c'.repeat(64),
        productionResourceState: 'present_verified',
      }).success
    ).toBe(false);
    expect(
      PointerCacheSchema.safeParse({
        ...readback.pointerCache,
        acceptedCfCacheStatuses: ['BYPASS'],
      }).success
    ).toBe(false);
  });
});
