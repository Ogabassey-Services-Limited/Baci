import { describe, expect, it } from 'vitest';
import { executeDeepCloudflareEvidenceQualification } from './cloudflare-evidence-provider-qualification';
import {
  buildClosedEvidenceProcessEnvironment,
  executeCloudflareEvidenceQualification,
  parseQualificationArguments,
  qualifyCloudflareEvidenceReadback,
  qualifyCloudflareReleasePurgeContract,
  qualifyCloudflareTopologyEndpoints,
} from './qualify-cloudflare-evidence-sources';

describe('parseQualificationArguments', () => {
  it('only accepts credentialless --prepare', () => {
    expect(parseQualificationArguments(['--prepare']).mode).toBe('prepare');
    expect(() =>
      parseQualificationArguments(['--prepare', '--token', 'secret'])
    ).toThrow('credentialless');
    expect(
      parseQualificationArguments([
        '--validate-readback',
        '/private/receipt.json',
      ]).mode
    ).toBe('validate-readback');
  });
});

describe('Cloudflare read-only qualification contracts', () => {
  const readback = {
    apiFamily: 'scripts-versions',
    scriptName: 'baci-evidence-qualification',
    versions: [
      {
        versionId: 'a',
        endpoint:
          '/accounts/account/workers/scripts/baci-evidence-qualification/versions/a',
        scriptEtag: 'a'.repeat(64),
        moduleSha256: 'b'.repeat(64),
        settingsSha256: 'c'.repeat(64),
      },
      {
        versionId: 'b',
        endpoint:
          '/accounts/account/workers/scripts/baci-evidence-qualification/versions/b',
        scriptEtag: 'd'.repeat(64),
        moduleSha256: 'e'.repeat(64),
        settingsSha256: 'f'.repeat(64),
      },
    ],
    deploymentsEndpoint:
      '/accounts/account/workers/scripts/baci-evidence-qualification/deployments',
    pointerCache: {
      cacheRuleId: 'rule',
      cacheRulesetVersion: 'v1',
      traceExpressionSha256: 'a'.repeat(64),
      acceptedCfCacheStatuses: ['DYNAMIC'],
      requestCacheMode: 'no-store',
      repeatedProbeCount: 2,
      ageObserved: false,
      hitObserved: false,
      missObserved: false,
      qualifiedAt: '2026-07-31T00:00:00.000Z',
      expiresAt: '2026-07-31T00:02:00.000Z',
      canonicalSha256: 'b'.repeat(64),
    },
  };
  it('rejects swapped/latest-only script artifacts and cache hits', () => {
    expect(qualifyCloudflareEvidenceReadback(readback).ok).toBe(true);
    expect(
      qualifyCloudflareEvidenceReadback({
        ...readback,
        versions: [
          readback.versions[0],
          { ...readback.versions[1], moduleSha256: 'b'.repeat(64) },
        ],
      }).ok
    ).toBe(false);
    expect(
      qualifyCloudflareEvidenceReadback({
        ...readback,
        pointerCache: { ...readback.pointerCache, hitObserved: true },
      }).ok
    ).toBe(false);
  });
  it('constructs a closed one-token environment and rejects inherited credentials', () => {
    expect(
      buildClosedEvidenceProcessEnvironment('CLOUDFLARE_READ_TOKEN', 'read', {
        PATH: '/bin',
      })
    ).toEqual({ PATH: '/bin', CLOUDFLARE_READ_TOKEN: 'read' });
    expect(() =>
      buildClosedEvidenceProcessEnvironment('CLOUDFLARE_READ_TOKEN', 'read', {
        CLOUDFLARE_READ_TOKEN: 'read',
        CLOUDFLARE_WRITE_TOKEN: 'write',
      })
    ).toThrow('inherited');
  });
  it('fails closed for malformed purge and topology endpoint schemas', () => {
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
            endpoint: '/accounts/account/r2/buckets/bucket/domains',
            requestSchemaSha256: 'a'.repeat(64),
            responseSchemaSha256: 'b'.repeat(64),
            maximumVisibilitySeconds: 60,
          },
        ],
      }).ok
    ).toBe(true);
  });
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
        return ['a', 'b'];
      },
      trace: async () => {
        calls.push('trace');
        return { matched: true };
      },
      pointerProbe: async (method: 'GET' | 'HEAD') => {
        calls.push(method);
        return { cfCacheStatus: 'DYNAMIC' };
      },
      temporaryPurge: async (endpoint: string) => {
        calls.push(endpoint);
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
        pointerUrl: 'https://edge-evidence.ogabassey.com/',
        purge: {
          endpoint: '/zones/zone/purge_cache',
          requestSchemaSha256: 'a'.repeat(64),
          rateLimitFingerprint: 'b'.repeat(64),
          policySha256: 'c'.repeat(64),
          productionResourceState: 'present_verified',
        },
        topology: {
          family: 'r2-custom-domain',
          endpoint: '/accounts/account/r2/buckets/bucket/domains',
          requestSchemaSha256: 'a'.repeat(64),
          responseSchemaSha256: 'b'.repeat(64),
          maximumVisibilitySeconds: 60,
        },
      })
    ).resolves.toMatchObject({ qualified: true, purgeStatus: 'lost_response' });
    expect(calls).toEqual([
      'list',
      'version:a',
      'version:b',
      'deployments',
      'trace',
      'GET',
      'HEAD',
      '/zones/zone/purge_cache',
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
          pointerUrl: 'https://edge-evidence.ogabassey.com/',
          purge: {
            endpoint: '/zones/zone/purge_cache',
            requestSchemaSha256: 'a'.repeat(64),
            rateLimitFingerprint: 'b'.repeat(64),
            policySha256: 'c'.repeat(64),
            productionResourceState: 'present_verified',
          },
          topology: {
            family: 'r2-custom-domain',
            endpoint: '/accounts/account/r2/buckets/bucket/domains',
            requestSchemaSha256: 'a'.repeat(64),
            responseSchemaSha256: 'b'.repeat(64),
            maximumVisibilitySeconds: 60,
          },
        }
      )
    ).rejects.toThrow('cacheable');
  });
  it('requires repeated GET/HEAD and independent converged tuples for all topology families', async () => {
    const topologies = [
      'worker-custom-domain',
      'r2-cors',
      'r2-custom-domain',
    ] as const;
    const reads = new Map(topologies.map((family) => [family, 0]));
    const calls: string[] = [];
    const client = {
      trace: async () => ({
        cacheRuleId: 'rule',
        rulesetVersion: 'v1',
        expressionSha256: 'a'.repeat(64),
        matched: true,
      }),
      pointerProbe: async (method: 'GET' | 'HEAD') => {
        calls.push(method);
        return { cfCacheStatus: 'DYNAMIC' };
      },
      topologyRead: async (family: (typeof topologies)[number]) => {
        const index = reads.get(family) ?? 0;
        reads.set(family, index + 1);
        return {
          state: ['before', 'intermediate', 'after'][index],
          fingerprint: `${family}-${index}`,
        };
      },
      topologyMutate: async (family: string) => {
        calls.push(`mutate:${family}`);
        return { lostResponse: true };
      },
      topologyConverged: async () => true,
      topologyControlNoEffect: async () => true,
    };
    const input = {
      pointerUrl: 'https://edge-evidence.ogabassey.com/',
      pointerProbeCount: 2,
      trace: {
        cacheRuleId: 'rule',
        rulesetVersion: 'v1',
        expressionSha256: 'a'.repeat(64),
      },
      topologies: topologies.map((family) => ({
        family,
        action: family === 'r2-cors' ? 'write' : 'detach',
        endpoint: `/accounts/account/${family}`,
        requestSchemaSha256: 'b'.repeat(64),
        maximumVisibilitySeconds: 60,
        before: { state: 'before', fingerprint: `${family}-0` },
        intermediate: { state: 'intermediate', fingerprint: `${family}-1` },
        after: { state: 'after', fingerprint: `${family}-2` },
      })) as never,
    };
    await expect(
      executeDeepCloudflareEvidenceQualification(client, input)
    ).resolves.toEqual({ qualified: true });
    expect(calls.filter((call) => call === 'GET')).toHaveLength(2);
    expect(calls.filter((call) => call === 'HEAD')).toHaveLength(2);
    await expect(
      executeDeepCloudflareEvidenceQualification(client, {
        ...input,
        pointerProbeCount: 1,
      })
    ).rejects.toThrow('repeated');
    await expect(
      executeDeepCloudflareEvidenceQualification(
        {
          ...client,
          trace: async () => ({
            cacheRuleId: 'wrong',
            rulesetVersion: 'v1',
            expressionSha256: 'a'.repeat(64),
            matched: true,
          }),
        },
        input
      )
    ).rejects.toThrow('Trace');
  });
});
