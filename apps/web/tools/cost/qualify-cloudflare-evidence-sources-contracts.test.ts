import { describe, expect, it } from 'vitest';
import {
  type CloudflarePurgeReadback,
  type CloudflarePurgeReadbackRequest,
  type CloudflareTraceExpectation,
  matchesCloudflarePurgeReadback,
  matchesCloudflareTrace,
} from './qualify-cloudflare-evidence-sources-contracts';

const request: CloudflarePurgeReadbackRequest = {
  operationId: 'purge',
  endpoint: '/zones/zone/purge_cache',
  zoneId: 'zone',
  requestSchemaSha256: 'a'.repeat(64),
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
  });
});
