import { describe, expect, it } from 'vitest';
import {
  type CloudflareQualificationClient,
  executeCloudflareEvidenceQualification,
  QUALIFICATION_POINTER_URL,
} from './qualify-cloudflare-evidence-sources';
import { readback } from './qualify-cloudflare-evidence-sources.test-fixtures';

const input = {
  accountId: 'account',
  scriptName: readback.scriptName,
  artifacts: [readback.versions[0], readback.versions[1]] as const,
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
  topology: {
    family: 'r2-custom-domain' as const,
    endpoint:
      '/accounts/account/r2/buckets/bucket/domains/custom/edge-evidence.ogabassey.com',
    requestSchemaSha256: 'a'.repeat(64),
    responseSchemaSha256: 'b'.repeat(64),
    maximumVisibilitySeconds: 60,
  },
  zoneId: 'zone',
  ownerAcceptance: readback.zeroWeightProof.ownerAcceptance,
  trace: {
    cacheRuleId: readback.pointerCache.cacheRuleId,
    rulesetVersion: readback.pointerCache.cacheRulesetVersion,
    expressionSha256: readback.pointerCache.traceExpressionSha256,
  },
};

const client = (
  overrides: Partial<CloudflareQualificationClient> = {}
): CloudflareQualificationClient => ({
  listVersions: async () => ['a', 'b'],
  readVersion: async (_account, _script, versionId) => {
    const version = readback.versions.find(
      ({ versionId: id }) => id === versionId
    );
    if (!version) throw new Error('unexpected version');
    return version;
  },
  readDeployments: async () => readback.deployments,
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
  pointerProbe: async () => ({ cfCacheStatus: 'DYNAMIC' }),
  temporaryPurge: async () => ({ operationId: 'purge' }),
  readPurge: async () => 'complete',
  topologyConverged: async () => true,
  ...overrides,
});

describe('executeCloudflareEvidenceQualification zero-weight proof', () => {
  it('rejects ordinary traffic that observes any candidate invocation', async () => {
    await expect(
      executeCloudflareEvidenceQualification(
        client({
          readOrdinaryTrafficProof: async () => ({
            ...readback.zeroWeightProof.ordinaryTraffic,
            bInvocationCount: 1,
          }),
        }),
        input
      )
    ).rejects.toThrow('ordinary_traffic_b_invocations_observed');
  });

  it('rejects a protected override without candidate Version Metadata', async () => {
    await expect(
      executeCloudflareEvidenceQualification(
        client({
          readProtectedVersionOverrideProof: async () => ({
            ...readback.zeroWeightProof.protectedOverride,
            servedVersionId: 'a',
            versionMetadataVersionId: 'a',
          }),
        }),
        input
      )
    ).rejects.toThrow('protected_override_served_wrong_version');
  });
});
