import { describe, expect, it } from 'vitest';
import {
  buildClosedEvidenceProcessEnvironment,
  qualifyCloudflareEvidenceReadback,
  qualifyCloudflareReleasePurgeContract,
  qualifyCloudflareTopologyEndpoints,
  REVIEWED_EVIDENCE_SYSTEM_PATH,
} from './qualify-cloudflare-evidence-sources';
import {
  qualificationAuthorityOptions,
  readback,
  reviewedArtifacts,
} from './qualify-cloudflare-evidence-sources.test-fixtures';

const ownerAcceptanceOptions = {
  expectedOwnerApprovalId: 'owner-approval',
  ownerAcceptanceAuthority: () => readback.zeroWeightProof.ownerAcceptance,
  ...qualificationAuthorityOptions,
};
const readbackOptions = {
  now: new Date('2026-07-31T00:01:00.000Z'),
  expectedArtifacts: [reviewedArtifacts[0], reviewedArtifacts[1]] as const,
  expectedScriptName: readback.scriptName,
  ...ownerAcceptanceOptions,
};

describe('Cloudflare read-only qualification contracts', () => {
  it('rejects swapped/latest-only script artifacts and cache hits', () => {
    expect(
      qualifyCloudflareEvidenceReadback(readback, {
        ...readbackOptions,
        expectedAccountId: 'other-account',
      })
    ).toEqual({ ok: false, reason: 'reviewed_artifacts_invalid' });
    expect(
      qualifyCloudflareEvidenceReadback(readback, readbackOptions).ok
    ).toBe(true);
    expect(
      qualifyCloudflareEvidenceReadback(
        {
          ...readback,
          versions: [
            readback.versions[0],
            { ...readback.versions[1], moduleSha256: 'b'.repeat(64) },
          ],
        },
        readbackOptions
      )
    ).toEqual({ ok: false, reason: 'measurement_payload_mismatch' });
    expect(
      qualifyCloudflareEvidenceReadback(
        {
          ...readback,
          pointerCache: { ...readback.pointerCache, hitObserved: true },
        },
        readbackOptions
      )
    ).toEqual({ ok: false, reason: 'readback_schema_invalid' });
    expect(
      qualifyCloudflareEvidenceReadback(
        {
          ...readback,
          pointerCache: {
            ...readback.pointerCache,
            acceptedCfCacheStatuses: ['BYPASS'],
          },
        },
        readbackOptions
      )
    ).toEqual({ ok: false, reason: 'readback_schema_invalid' });
    expect(
      qualifyCloudflareEvidenceReadback(
        {
          ...readback,
          pointerCache: {
            ...readback.pointerCache,
            pointerUrl: 'https://edge-evidence.ogabassey.com/',
          },
        },
        readbackOptions
      )
    ).toEqual({ ok: false, reason: 'readback_schema_invalid' });
  });

  it('constructs a closed one-token environment and rejects inherited credentials', () => {
    expect(
      buildClosedEvidenceProcessEnvironment('CLOUDFLARE_READ_TOKEN', 'read', {
        PATH: '/bin',
      })
    ).toEqual({
      PATH: REVIEWED_EVIDENCE_SYSTEM_PATH,
      CLOUDFLARE_READ_TOKEN: 'read',
    });
    expect(() =>
      buildClosedEvidenceProcessEnvironment('CLOUDFLARE_READ_TOKEN', 'read', {
        CLOUDFLARE_READ_TOKEN: 'read',
        CLOUDFLARE_WRITE_TOKEN: 'write',
      })
    ).toThrow('inherited');
  });

  it('fails closed for malformed purge and incomplete topology endpoint schemas', () => {
    expect(
      qualifyCloudflareReleasePurgeContract({
        endpoint: '/zones/zone/purge_cache',
        requestSchemaSha256: 'a'.repeat(64),
        rateLimitFingerprint: 'b'.repeat(64),
        policySha256: 'c'.repeat(64),
        productionResourceState: 'absent_requires_bootstrap',
      }).ok
    ).toBe(true);
    expect(
      qualifyCloudflareReleasePurgeContract({
        endpoint: '/zones/zone/purge_cache',
        requestSchemaSha256: 'bad',
        rateLimitFingerprint: 'b'.repeat(64),
        policySha256: 'c'.repeat(64),
        productionResourceState: 'absent_requires_bootstrap',
      }).ok
    ).toBe(false);
    expect(
      qualifyCloudflareTopologyEndpoints({
        endpoints: [
          {
            family: 'r2-custom-domain',
            endpoint:
              '/accounts/account/r2/buckets/bucket/domains/custom/edge-evidence.ogabassey.com',
            requestSchemaSha256: 'a'.repeat(64),
            responseSchemaSha256: 'b'.repeat(64),
            maximumVisibilitySeconds: 60,
          },
        ],
      }).ok
    ).toBe(false);
    const topologyEndpoints = [
      {
        family: 'worker-custom-domain' as const,
        endpoint:
          '/accounts/account/workers/scripts/baci-evidence-qualification/domains/custom/edge-evidence.ogabassey.com',
      },
      {
        family: 'r2-cors' as const,
        endpoint: '/accounts/account/r2/buckets/bucket/cors',
      },
      {
        family: 'r2-custom-domain' as const,
        endpoint:
          '/accounts/account/r2/buckets/bucket/domains/custom/edge-evidence.ogabassey.com',
      },
    ].map((topology) => ({
      ...topology,
      requestSchemaSha256: 'a'.repeat(64),
      responseSchemaSha256: 'b'.repeat(64),
      maximumVisibilitySeconds: 60,
    }));
    expect(
      qualifyCloudflareTopologyEndpoints({ endpoints: topologyEndpoints }).ok
    ).toBe(true);
    expect(
      qualifyCloudflareTopologyEndpoints({
        endpoints: topologyEndpoints.map((topology) =>
          topology.family === 'worker-custom-domain'
            ? {
                ...topology,
                endpoint:
                  '/accounts/account/workers/scripts/production-storefront/domains/custom/edge-evidence.ogabassey.com',
              }
            : topology
        ),
      }).ok
    ).toBe(false);
    expect(
      qualifyCloudflareTopologyEndpoints({
        endpoints: topologyEndpoints.map((topology) =>
          topology.family === 'r2-cors'
            ? { ...topology, family: 'r2-custom-domain' as const }
            : topology
        ),
      }).ok
    ).toBe(false);
  });

  it('requires reviewed local artifacts and rejects duplicate readback identities', () => {
    expect(
      qualifyCloudflareEvidenceReadback(readback, {
        now: new Date('2026-07-31T00:01:00.000Z'),
        expectedArtifacts: [reviewedArtifacts[0], reviewedArtifacts[1]],
        expectedScriptName: 'unreviewed-worker',
        ...ownerAcceptanceOptions,
      }).ok
    ).toBe(false);
    expect(
      qualifyCloudflareEvidenceReadback(readback, {
        now: new Date('2026-07-31T00:01:00.000Z'),
        expectedArtifacts: [reviewedArtifacts[0], reviewedArtifacts[1]],
        expectedScriptName: readback.scriptName,
        ...ownerAcceptanceOptions,
      }).ok
    ).toBe(true);
    expect(
      qualifyCloudflareEvidenceReadback(readback, {
        now: new Date('2026-07-31T00:01:00.000Z'),
        expectedArtifacts: [
          { ...reviewedArtifacts[0], moduleSha256: '1'.repeat(64) },
          reviewedArtifacts[1],
        ],
        expectedScriptName: readback.scriptName,
        ...ownerAcceptanceOptions,
      }).ok
    ).toBe(false);
    expect(
      qualifyCloudflareEvidenceReadback(
        {
          ...readback,
          versions: [
            readback.versions[0],
            {
              ...readback.versions[1],
              versionId: readback.versions[0].versionId,
              endpoint: readback.versions[0].endpoint,
            },
          ],
        },
        {
          now: new Date('2026-07-31T00:01:00.000Z'),
          expectedArtifacts: [reviewedArtifacts[0], reviewedArtifacts[1]],
          expectedScriptName: readback.scriptName,
          ...ownerAcceptanceOptions,
        }
      ).ok
    ).toBe(false);
  });

  it('rejects a readback deployment that does not bind the exact 100/0 tuple', () => {
    expect(
      qualifyCloudflareEvidenceReadback(
        {
          ...readback,
          deployments: {
            ...readback.deployments,
            versions: [
              { versionId: 'a', percentage: 50 },
              { versionId: 'b', percentage: 50 },
            ],
          },
        },
        {
          now: new Date('2026-07-31T00:01:00.000Z'),
          expectedArtifacts: [reviewedArtifacts[0], reviewedArtifacts[1]],
          expectedScriptName: readback.scriptName,
          ...ownerAcceptanceOptions,
        }
      ).ok
    ).toBe(false);
  });
});
