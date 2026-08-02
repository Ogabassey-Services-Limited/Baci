import { describe, expect, it } from 'vitest';
import {
  type CloudflarePurgeReadback,
  type CloudflarePurgeReadbackRequest,
  type CloudflareTraceExpectation,
  matchesCloudflarePointerProbe,
  matchesCloudflarePurgeContractReadback,
  matchesCloudflarePurgeReadback,
  matchesCloudflareTrace,
} from './qualify-cloudflare-evidence-sources-contracts';

const request: CloudflarePurgeReadbackRequest = {
  operationId: 'purge',
  endpoint: '/zones/zone/purge_cache',
  zoneId: 'zone',
  requestSchemaSha256: 'a'.repeat(64),
  rateLimitFingerprint: 'b'.repeat(64),
  policySha256: 'c'.repeat(64),
  body: { hosts: ['edge-evidence.ogabassey.com'] },
};
const readback: CloudflarePurgeReadback = {
  ...request,
  status: 'complete',
};
const trace: CloudflareTraceExpectation = {
  cacheRuleId: 'rule',
  rulesetVersion: 'v1',
  expressionSha256: 'a'.repeat(64),
};

describe('qualification source contract bindings', () => {
  it('requires every reviewed Trace identity to match', () => {
    expect(matchesCloudflareTrace({ matched: true, ...trace }, trace)).toBe(
      true
    );
    expect(
      matchesCloudflareTrace(
        { matched: true, ...trace, cacheRuleId: 'other-rule' },
        trace
      )
    ).toBe(false);
    expect(
      matchesCloudflareTrace(
        { matched: true, ...trace, rulesetVersion: 'other-version' },
        trace
      )
    ).toBe(false);
    expect(
      matchesCloudflareTrace(
        { matched: true, ...trace, expressionSha256: 'b'.repeat(64) },
        trace
      )
    ).toBe(false);
    expect(matchesCloudflareTrace({ matched: false, ...trace }, trace)).toBe(
      false
    );
    expect(matchesCloudflareTrace({ matched: true, ...trace }, undefined)).toBe(
      false
    );
  });

  it('requires purge readback identity to match the submitted request', () => {
    expect(matchesCloudflarePurgeReadback(readback, request)).toBe(true);
    expect(
      matchesCloudflarePurgeReadback(
        { ...readback, operationId: 'other-purge' },
        request
      )
    ).toBe(false);
    expect(
      matchesCloudflarePurgeReadback(
        { ...readback, endpoint: '/zones/other/purge_cache' },
        request
      )
    ).toBe(false);
    expect(
      matchesCloudflarePurgeReadback(
        { ...readback, zoneId: 'other-zone' },
        request
      )
    ).toBe(false);
    expect(
      matchesCloudflarePurgeReadback(
        { ...readback, requestSchemaSha256: 'd'.repeat(64) },
        request
      )
    ).toBe(false);
    expect(
      matchesCloudflarePurgeReadback(
        { ...readback, status: 'incomplete' as never },
        request
      )
    ).toBe(false);
    expect(
      matchesCloudflarePurgeReadback(
        { ...readback, body: { hosts: ['other.example.com'] } },
        request
      )
    ).toBe(false);
    expect(
      matchesCloudflarePurgeReadback(
        { ...readback, rateLimitFingerprint: 'd'.repeat(64) },
        request
      )
    ).toBe(false);
    expect(
      matchesCloudflarePurgeReadback(
        { ...readback, policySha256: 'd'.repeat(64) },
        request
      )
    ).toBe(false);
  });

  it('requires the provider purge contract to bind both policy fingerprints', () => {
    expect(
      matchesCloudflarePurgeContractReadback(
        {
          endpoint: request.endpoint,
          requestSchemaSha256: request.requestSchemaSha256,
          rateLimitFingerprint: request.rateLimitFingerprint,
          policySha256: request.policySha256,
          productionResourceState: 'present_verified',
        },
        {
          endpoint: request.endpoint,
          requestSchemaSha256: request.requestSchemaSha256,
          rateLimitFingerprint: request.rateLimitFingerprint,
          policySha256: request.policySha256,
          productionResourceState: 'present_verified',
        }
      )
    ).toBe(true);
    expect(
      matchesCloudflarePurgeContractReadback(
        {
          endpoint: request.endpoint,
          requestSchemaSha256: request.requestSchemaSha256,
          rateLimitFingerprint: 'd'.repeat(64),
          policySha256: request.policySha256,
          productionResourceState: 'present_verified',
        },
        {
          endpoint: request.endpoint,
          requestSchemaSha256: request.requestSchemaSha256,
          rateLimitFingerprint: request.rateLimitFingerprint,
          policySha256: request.policySha256,
          productionResourceState: 'present_verified',
        }
      )
    ).toBe(false);
  });

  it('requires the expected fixture status, cache state, and response headers', () => {
    const expected = { bundle: 'version-a-204', version: 'a' };
    const pointer = {
      status: 204,
      cfCacheStatus: 'DYNAMIC',
      headers: {
        'X-Baci-Evidence-Bundle': 'version-a-204',
        'X-Baci-Evidence-Version': 'a',
      },
    } as const;
    expect(matchesCloudflarePointerProbe(pointer, expected)).toBe(true);
    expect(
      matchesCloudflarePointerProbe({ ...pointer, status: 404 }, expected)
    ).toBe(false);
    expect(
      matchesCloudflarePointerProbe(
        {
          ...pointer,
          headers: { ...pointer.headers, 'X-Baci-Evidence-Bundle': 'other' },
        },
        expected
      )
    ).toBe(false);
    expect(
      matchesCloudflarePointerProbe(
        {
          ...pointer,
          headers: { ...pointer.headers, 'X-Baci-Evidence-Version': 'other' },
        },
        expected
      )
    ).toBe(false);
  });
});
