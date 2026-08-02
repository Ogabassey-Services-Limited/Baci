import { describe, expect, it } from 'vitest';
import {
  PurgeContractSchema,
  QualificationControlEvidenceSchema,
  TopologyEndpointSchema,
} from './cloudflare-evidence-qualification-contracts';
import { readback } from './qualify-cloudflare-evidence-sources.test-fixtures';

describe('qualification provider contracts', () => {
  it('requires the bounded purge endpoint and topology fingerprints', () => {
    const hash = 'a'.repeat(64);
    expect(
      PurgeContractSchema.safeParse({
        endpoint: '/zones/zone/purge_cache',
        requestSchemaSha256: hash,
        rateLimitFingerprint: hash,
        policySha256: hash,
        productionResourceState: 'present_verified',
      }).success
    ).toBe(true);
    expect(
      TopologyEndpointSchema.safeParse({
        family: 'r2-cors',
        endpoint: '/accounts/account/r2/buckets/bucket/cors',
        requestSchemaSha256: hash,
        responseSchemaSha256: hash,
        maximumVisibilitySeconds: 60,
      }).success
    ).toBe(true);
    expect(
      QualificationControlEvidenceSchema.safeParse(readback.controlEvidence)
        .success
    ).toBe(true);
    expect(
      QualificationControlEvidenceSchema.safeParse({
        ...readback.controlEvidence,
        topology: readback.controlEvidence.topology.map((receipt, index) =>
          index === 0 ? { ...receipt, restoreAction: 'detach' } : receipt
        ),
      }).success
    ).toBe(false);
  });
});
