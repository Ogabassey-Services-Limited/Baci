import { describe, expect, it } from 'vitest';
import {
  executeCloudflareEvidenceQualification,
  QUALIFICATION_POINTER_URL,
} from './qualify-cloudflare-evidence-sources';
import {
  pointerProbeReadback,
  qualificationInput,
  readback,
} from './qualify-cloudflare-evidence-sources.test-fixtures';
import type { CloudflarePurgeReadbackRequest } from './qualify-cloudflare-evidence-sources-contracts';

describe('Cloudflare read-only qualification contracts', () => {
  it('executes Scripts Versions, Deployments, Trace, repeated pointers, and bounded purge through an injected client', async () => {
    const calls: string[] = [];
    const artifactA = readback.versions[0];
    const artifactB = readback.versions[1];
    const client = {
      listVersions: async () => {
        calls.push('list');
        return ['a', 'b'];
      },
      readVersion: async (
        _account: string,
        _script: string,
        versionId: string
      ) => {
        calls.push(`version:${versionId}`);
        const version = versionId === 'a' ? artifactA : artifactB;
        return {
          versionId,
          scriptEtag: version.scriptEtag,
          moduleSha256: version.moduleSha256,
          modules: version.modules,
          moduleListSha256: version.moduleListSha256,
          settingsSha256: version.settingsSha256,
        };
      },
      readDeployments: async () => {
        calls.push('deployments');
        return {
          deploymentId: 'deployment',
          versions: [
            { versionId: 'a', percentage: 100 },
            { versionId: 'b', percentage: 0 },
          ],
        };
      },
      readZeroWeightContract: async () => {
        calls.push('zero-weight-contract');
        return readback.zeroWeightProof;
      },
      readOrdinaryTrafficProof: async () => {
        calls.push('ordinary-traffic');
        return readback.zeroWeightProof.ordinaryTraffic;
      },
      readProtectedVersionOverrideProof: async () => {
        calls.push('protected-override');
        return readback.zeroWeightProof.protectedOverride;
      },
      trace: async () => {
        calls.push('trace');
        return {
          matched: true,
          cacheRuleId: readback.pointerCache.cacheRuleId,
          rulesetVersion: readback.pointerCache.cacheRulesetVersion,
          expressionSha256: readback.pointerCache.traceExpressionSha256,
        };
      },
      pointerProbe: async (method: 'GET' | 'HEAD') => {
        calls.push(method);
        return pointerProbeReadback;
      },
      readPurgeContract: async () => ({
        endpoint: '/zones/zone/purge_cache',
        requestSchemaSha256: 'a'.repeat(64),
        rateLimitFingerprint: 'b'.repeat(64),
        policySha256: 'c'.repeat(64),
        productionResourceState: 'present_verified' as const,
      }),
      temporaryPurge: async (request: {
        endpoint: string;
        zoneId: string;
        requestSchemaSha256: string;
        body: { hosts: readonly ['edge-evidence.ogabassey.com'] };
      }) => {
        calls.push(
          `${request.endpoint}:${request.zoneId}:${request.body.hosts[0]}`
        );
        return { operationId: 'purge' };
      },
      readPurge: async () => {
        calls.push('purge-read');
        return 'lost_response' as const;
      },
      readPurgeReadback: async (request: CloudflarePurgeReadbackRequest) => {
        calls.push('purge-readback');
        return { status: 'complete' as const, ...request };
      },
      topologyConverged: async (topology) => {
        calls.push(
          `topology:${topology.family}:${topology.endpoint}:${topology.maximumVisibilitySeconds}`
        );
        return true;
      },
    };
    await expect(
      executeCloudflareEvidenceQualification(client, {
        accountId: 'account',
        scriptName: readback.scriptName,
        artifacts: [artifactA, artifactB],
        pointerUrl: QUALIFICATION_POINTER_URL,
        purge: {
          endpoint: '/zones/zone/purge_cache',
          requestSchemaSha256: 'a'.repeat(64),
          rateLimitFingerprint: 'b'.repeat(64),
          policySha256: 'c'.repeat(64),
          productionResourceState: 'present_verified',
        },
        journaledPurge: {
          zoneId: 'zone',
          contract: {
            endpoint: '/zones/zone/purge_cache',
            requestSchemaSha256: 'a'.repeat(64),
            rateLimitFingerprint: 'b'.repeat(64),
            policySha256: 'c'.repeat(64),
            productionResourceState: 'present_verified',
          },
        },
        topology: qualificationInput.topology,
        zoneId: 'zone',
        ownerAcceptance: readback.zeroWeightProof.ownerAcceptance,
        ownerAcceptanceAuthority: () =>
          readback.zeroWeightProof.ownerAcceptance,
        expectedOwnerApprovalId: 'owner-approval',
        expectedZeroWeightContract:
          qualificationInput.expectedZeroWeightContract,
        now: new Date('2026-07-31T01:00:00.000Z'),
        trace: {
          cacheRuleId: readback.pointerCache.cacheRuleId,
          rulesetVersion: readback.pointerCache.cacheRulesetVersion,
          expressionSha256: readback.pointerCache.traceExpressionSha256,
        },
      })
    ).resolves.toMatchObject({ qualified: true, purgeStatus: 'lost_response' });
    expect(calls).toEqual([
      'list',
      'version:a',
      'version:b',
      'deployments',
      'zero-weight-contract',
      'ordinary-traffic',
      'protected-override',
      'trace',
      'GET',
      'GET',
      'HEAD',
      'HEAD',
      '/zones/zone/purge_cache:zone:edge-evidence.ogabassey.com',
      'purge-read',
      'purge-readback',
      'topology:worker-custom-domain:/accounts/account/workers/scripts/baci-evidence-qualification/domains/custom/edge-evidence.ogabassey.com:60',
      'topology:r2-cors:/accounts/account/r2/buckets/bucket/cors:60',
      'topology:r2-custom-domain:/accounts/account/r2/buckets/bucket/domains/custom/edge-evidence.ogabassey.com:60',
    ]);
    await expect(
      executeCloudflareEvidenceQualification(
        {
          ...client,
          pointerProbe: async () => ({
            ...pointerProbeReadback,
            cfCacheStatus: 'HIT',
            age: '1',
          }),
        },
        {
          accountId: 'account',
          scriptName: readback.scriptName,
          artifacts: [artifactA, artifactB],
          pointerUrl: QUALIFICATION_POINTER_URL,
          purge: {
            endpoint: '/zones/zone/purge_cache',
            requestSchemaSha256: 'a'.repeat(64),
            rateLimitFingerprint: 'b'.repeat(64),
            policySha256: 'c'.repeat(64),
            productionResourceState: 'present_verified',
          },
          journaledPurge: {
            zoneId: 'zone',
            contract: {
              endpoint: '/zones/zone/purge_cache',
              requestSchemaSha256: 'a'.repeat(64),
              rateLimitFingerprint: 'b'.repeat(64),
              policySha256: 'c'.repeat(64),
              productionResourceState: 'present_verified',
            },
          },
          topology: qualificationInput.topology,
          zoneId: 'zone',
          ownerAcceptance: readback.zeroWeightProof.ownerAcceptance,
          ownerAcceptanceAuthority: () =>
            readback.zeroWeightProof.ownerAcceptance,
          expectedOwnerApprovalId: 'owner-approval',
          expectedZeroWeightContract:
            qualificationInput.expectedZeroWeightContract,
          now: new Date('2026-07-31T01:00:00.000Z'),
          trace: {
            cacheRuleId: readback.pointerCache.cacheRuleId,
            rulesetVersion: readback.pointerCache.cacheRulesetVersion,
            expressionSha256: readback.pointerCache.traceExpressionSha256,
          },
        }
      )
    ).rejects.toThrow('cacheable');
  });
});
