import { describe, expect, it } from 'vitest';
import {
  buildClosedEvidenceProcessEnvironment,
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
  it('constructs a closed one-token environment and rejects inherited dual credentials', () => {
    expect(
      buildClosedEvidenceProcessEnvironment('CLOUDFLARE_READ_TOKEN', 'read', {
        PATH: '/bin',
        CLOUDFLARE_WRITE_TOKEN: 'write',
      })
    ).toEqual({ PATH: '/bin', CLOUDFLARE_READ_TOKEN: 'read' });
    expect(() =>
      buildClosedEvidenceProcessEnvironment('CLOUDFLARE_READ_TOKEN', 'read', {
        CLOUDFLARE_READ_TOKEN: 'read',
        CLOUDFLARE_WRITE_TOKEN: 'write',
      })
    ).toThrow('both credentials');
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
});
