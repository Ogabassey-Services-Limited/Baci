import { describe, expect, it } from 'vitest';
import { qualifyCloudflareTopologyEndpoints } from './cloudflare-evidence-topology-contract';

const endpoints = [
  {
    family: 'worker-custom-domain' as const,
    endpoint:
      '/accounts/account/workers/scripts/baci-evidence-qualification/domains/custom/edge-evidence.ogabassey.com',
    requestSchemaSha256: 'a'.repeat(64),
    responseSchemaSha256: 'b'.repeat(64),
    maximumVisibilitySeconds: 60,
  },
  {
    family: 'r2-cors' as const,
    endpoint: '/accounts/account/r2/buckets/bucket/cors',
    requestSchemaSha256: 'c'.repeat(64),
    responseSchemaSha256: 'd'.repeat(64),
    maximumVisibilitySeconds: 60,
  },
  {
    family: 'r2-custom-domain' as const,
    endpoint:
      '/accounts/account/r2/buckets/bucket/domains/custom/edge-evidence.ogabassey.com',
    requestSchemaSha256: 'e'.repeat(64),
    responseSchemaSha256: 'f'.repeat(64),
    maximumVisibilitySeconds: 60,
  },
] as const;

describe('Cloudflare topology contract', () => {
  it('accepts one exact endpoint for each family', () => {
    expect(qualifyCloudflareTopologyEndpoints({ endpoints }).ok).toBe(true);
  });

  it('rejects a missing family or unrelated qualification worker', () => {
    expect(
      qualifyCloudflareTopologyEndpoints({
        endpoints: [endpoints[0], endpoints[1], endpoints[1]],
      }).ok
    ).toBe(false);
    expect(
      qualifyCloudflareTopologyEndpoints({
        endpoints: endpoints.map((endpoint) =>
          endpoint.family === 'worker-custom-domain'
            ? {
                ...endpoint,
                endpoint: endpoint.endpoint.replace(
                  'baci-evidence-qualification',
                  'production-worker'
                ),
              }
            : endpoint
        ),
      }).ok
    ).toBe(false);
  });
});
