import { describe, expect, it } from 'vitest';
import {
  executeCloudflareEvidenceQualification,
  QUALIFICATION_POINTER_URL,
} from './qualify-cloudflare-evidence-sources';
import { readback } from './qualify-cloudflare-evidence-sources.test-fixtures';

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
        return { matched: true };
      },
      pointerProbe: async (method: 'GET' | 'HEAD') => {
        calls.push(method);
        return { cfCacheStatus: 'DYNAMIC' };
      },
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
      topologyConverged: async (seconds: number) => {
        calls.push(`topology:${seconds}`);
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
        topology: {
          family: 'r2-custom-domain',
          endpoint: '/accounts/account/r2/buckets/bucket/domains',
          requestSchemaSha256: 'a'.repeat(64),
          responseSchemaSha256: 'b'.repeat(64),
          maximumVisibilitySeconds: 60,
        },
        zoneId: 'zone',
        ownerAcceptance: readback.zeroWeightProof.ownerAcceptance,
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
      'topology:60',
    ]);
    await expect(
      executeCloudflareEvidenceQualification(
        {
          ...client,
          pointerProbe: async () => ({ cfCacheStatus: 'HIT', age: '1' }),
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
          topology: {
            family: 'r2-custom-domain',
            endpoint: '/accounts/account/r2/buckets/bucket/domains',
            requestSchemaSha256: 'a'.repeat(64),
            responseSchemaSha256: 'b'.repeat(64),
            maximumVisibilitySeconds: 60,
          },
          zoneId: 'zone',
          ownerAcceptance: readback.zeroWeightProof.ownerAcceptance,
        }
      )
    ).rejects.toThrow('cacheable');
  });
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
      topology: {
        family: 'r2-custom-domain' as const,
        endpoint: '/accounts/account/r2/buckets/bucket/domains',
        requestSchemaSha256: 'a'.repeat(64),
        responseSchemaSha256: 'b'.repeat(64),
        maximumVisibilitySeconds: 60,
      },
      zoneId: 'zone',
      ownerAcceptance: readback.zeroWeightProof.ownerAcceptance,
    };
    const baseClient = {
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
      trace: async () => ({ matched: true }),
      pointerProbe: async () => ({ cfCacheStatus: 'DYNAMIC' }),
      temporaryPurge: async () => ({ operationId: 'purge' }),
      readPurge: async () => 'complete' as const,
      topologyConverged: async () => true,
    };
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
        } as never,
        baseInput
      )
    ).rejects.toThrow('100/0');
    await expect(
      executeCloudflareEvidenceQualification(
        {
          ...baseClient,
          pointerProbe: async () => ({ cfCacheStatus: 'BYPASS' }),
        } as never,
        baseInput
      )
    ).rejects.toThrow('cacheable');
    await expect(
      executeCloudflareEvidenceQualification(baseClient as never, {
        ...baseInput,
        pointerUrl: 'https://edge-evidence.ogabassey.com/',
      })
    ).rejects.toThrow('pointer URL');
    await expect(
      executeCloudflareEvidenceQualification(baseClient as never, {
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
      executeCloudflareEvidenceQualification(baseClient as never, {
        ...baseInput,
        purge: {
          ...baseInput.purge,
          policySha256: 'd'.repeat(64),
        },
      })
    ).rejects.toThrow('journaled');
  });
});
