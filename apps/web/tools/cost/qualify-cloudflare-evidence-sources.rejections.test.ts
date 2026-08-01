import { describe, expect, it } from 'vitest';
import {
  type CloudflareQualificationClient,
  executeCloudflareEvidenceQualification,
  QUALIFICATION_POINTER_URL,
} from './qualify-cloudflare-evidence-sources';
import {
  pointerProbeReadback,
  qualificationInput,
  readback,
} from './qualify-cloudflare-evidence-sources.test-fixtures';

describe('Cloudflare read-only qualification rejection contracts', () => {
  it('rejects BYPASS, unrelated evidence URLs, and noncanonical deployment tuples', async () => {
    const artifactA = readback.versions[0];
    const artifactB = readback.versions[1];
    const baseInput = {
      accountId: 'account',
      scriptName: readback.scriptName,
      artifacts: [artifactA, artifactB] as const,
      pointerUrl: QUALIFICATION_POINTER_URL,
      purge: {
        endpoint: '/zones/zone/purge_cache',
        requestSchemaSha256: 'a'.repeat(64),
        rateLimitFingerprint: 'b'.repeat(64),
        policySha256: 'c'.repeat(64),
        productionResourceState: 'present_verified' as const,
      },
      journaledPurge: {
        zoneId: 'zone',
        contract: {
          endpoint: '/zones/zone/purge_cache',
          requestSchemaSha256: 'a'.repeat(64),
          rateLimitFingerprint: 'b'.repeat(64),
          policySha256: 'c'.repeat(64),
          productionResourceState: 'present_verified' as const,
        },
      },
      topology: qualificationInput.topology,
      zoneId: 'zone',
      ownerAcceptance: readback.zeroWeightProof.ownerAcceptance,
      ownerAcceptanceAuthority: () => readback.zeroWeightProof.ownerAcceptance,
      expectedOwnerApprovalId: 'owner-approval',
      now: new Date('2026-07-31T01:00:00.000Z'),
      trace: {
        cacheRuleId: readback.pointerCache.cacheRuleId,
        rulesetVersion: readback.pointerCache.cacheRulesetVersion,
        expressionSha256: readback.pointerCache.traceExpressionSha256,
      },
    };
    const baseClient: CloudflareQualificationClient = {
      listVersions: async () => ['a', 'b'],
      readVersion: async (
        _account: string,
        _script: string,
        versionId: string
      ) => (versionId === 'a' ? artifactA : { ...artifactB, versionId }),
      readDeployments: async () => ({
        deploymentId: 'deployment',
        versions: [
          { versionId: 'a', percentage: 100 },
          { versionId: 'b', percentage: 0 },
        ],
      }),
      readZeroWeightContract: async () => readback.zeroWeightProof,
      readOrdinaryTrafficProof: async () =>
        readback.zeroWeightProof.ordinaryTraffic,
      readProtectedVersionOverrideProof: async () =>
        readback.zeroWeightProof.protectedOverride,
      trace: async () => ({
        matched: true,
        cacheRuleId: readback.pointerCache.cacheRuleId,
        rulesetVersion: readback.pointerCache.cacheRulesetVersion,
        expressionSha256: readback.pointerCache.traceExpressionSha256,
      }),
      pointerProbe: async () => pointerProbeReadback,
      readPurgeContract: async () => baseInput.purge,
      temporaryPurge: async () => ({ operationId: 'purge' }),
      readPurge: async () => 'complete' as const,
      topologyConverged: async () => true,
    };
    await expect(
      executeCloudflareEvidenceQualification(
        {
          ...baseClient,
          topologyConverged: async () => false,
        },
        baseInput
      )
    ).rejects.toThrow('topology did not converge');
    await expect(
      executeCloudflareEvidenceQualification(baseClient, {
        ...baseInput,
        topology: baseInput.topology.map((topology, index) =>
          index === 2
            ? {
                ...topology,
                endpoint: '/accounts/account/r2/buckets/bucket/domains',
              }
            : topology
        ) as typeof baseInput.topology,
      })
    ).rejects.toThrow('topology contract');
    await expect(
      executeCloudflareEvidenceQualification(baseClient, {
        ...baseInput,
        topology: baseInput.topology.map((topology, index) =>
          index === 2
            ? {
                ...topology,
                endpoint:
                  '/accounts/other-account/r2/buckets/bucket/domains/custom/edge-evidence.ogabassey.com',
              }
            : topology
        ) as typeof baseInput.topology,
      })
    ).rejects.toThrow('topology contract');
    await expect(
      executeCloudflareEvidenceQualification(
        {
          ...baseClient,
          readDeployments: async () => ({
            deploymentId: 'deployment',
            versions: [
              { versionId: 'a', percentage: 50 },
              { versionId: 'b', percentage: 50 },
            ],
          }),
        },
        baseInput
      )
    ).rejects.toThrow('100/0');
    await expect(
      executeCloudflareEvidenceQualification(
        {
          ...baseClient,
          pointerProbe: async () => ({
            ...pointerProbeReadback,
            cfCacheStatus: 'BYPASS',
          }),
        },
        baseInput
      )
    ).rejects.toThrow('cacheable');
    await expect(
      executeCloudflareEvidenceQualification(baseClient, {
        ...baseInput,
        pointerUrl: 'https://edge-evidence.ogabassey.com/',
      })
    ).rejects.toThrow('pointer URL');
    await expect(
      executeCloudflareEvidenceQualification(baseClient, {
        ...baseInput,
        journaledPurge: {
          ...baseInput.journaledPurge,
          contract: {
            ...baseInput.journaledPurge.contract,
            requestSchemaSha256: 'd'.repeat(64),
          },
        },
      })
    ).rejects.toThrow('journaled');
    await expect(
      executeCloudflareEvidenceQualification(baseClient, {
        ...baseInput,
        purge: {
          ...baseInput.purge,
          policySha256: 'd'.repeat(64),
        },
      })
    ).rejects.toThrow('journaled');
    await expect(
      executeCloudflareEvidenceQualification(
        {
          ...baseClient,
          readPurgeContract: async () => ({
            ...baseInput.purge,
            rateLimitFingerprint: 'd'.repeat(64),
          }),
        },
        baseInput
      )
    ).rejects.toThrow('provider contract');
    await expect(
      executeCloudflareEvidenceQualification(
        {
          ...baseClient,
          trace: async () => ({
            matched: true,
            cacheRuleId: 'unreviewed-rule',
            rulesetVersion: readback.pointerCache.cacheRulesetVersion,
            expressionSha256: readback.pointerCache.traceExpressionSha256,
          }),
        },
        baseInput
      )
    ).rejects.toThrow('exact cache rule');
    await expect(
      executeCloudflareEvidenceQualification(
        {
          ...baseClient,
          readPurge: async () => 'lost_response' as const,
        },
        baseInput
      )
    ).rejects.toThrow('purge-specific readback');
  });
});
