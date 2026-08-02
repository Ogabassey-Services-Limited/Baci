import { describe, expect, it } from 'vitest';
import {
  cloudflareTopologyEndpointParts,
  qualifyCloudflareQualificationTopology,
  qualifyCloudflareTopologyEndpoint,
  qualifyCloudflareTopologyEndpoints,
  verifyCloudflareTopologyEndpointFamily,
} from './cloudflare-evidence-topology-contract';

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
  it('qualifies a bounded endpoint only for the expected account', () => {
    expect(qualifyCloudflareTopologyEndpoint(endpoints[2], 'account').ok).toBe(
      true
    );
    expect(
      qualifyCloudflareTopologyEndpoint(
        {
          ...endpoints[2],
          endpoint: endpoints[2].endpoint.replace(
            '/accounts/account/',
            '/accounts/other-account/'
          ),
        },
        'account'
      ).ok
    ).toBe(false);
    expect(
      qualifyCloudflareTopologyEndpoint(
        {
          ...endpoints[2],
          endpoint: endpoints[2].endpoint.replace(
            '/domains/custom/edge-evidence.ogabassey.com',
            '/domains'
          ),
        },
        'account'
      ).ok
    ).toBe(false);
  });

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

  it('rejects topology endpoints from mixed accounts or R2 buckets', () => {
    expect(
      qualifyCloudflareTopologyEndpoints({
        endpoints: endpoints.map((endpoint) =>
          endpoint.family === 'worker-custom-domain'
            ? {
                ...endpoint,
                endpoint: endpoint.endpoint.replace(
                  '/accounts/account/',
                  '/accounts/other-account/'
                ),
              }
            : endpoint
        ),
      }).ok
    ).toBe(false);
    expect(
      qualifyCloudflareTopologyEndpoints({
        endpoints: endpoints.map((endpoint) =>
          endpoint.family === 'r2-custom-domain'
            ? {
                ...endpoint,
                endpoint: endpoint.endpoint.replace(
                  '/buckets/bucket/',
                  '/buckets/other-bucket/'
                ),
              }
            : endpoint
        ),
      }).ok
    ).toBe(false);
  });

  it.each([
    ['a trailing slash', `${endpoints[2].endpoint}/`],
    [
      'a duplicate account separator',
      endpoints[2].endpoint.replace(
        '/accounts/account/',
        '/accounts//account/'
      ),
    ],
    [
      'a duplicate resource separator',
      endpoints[2].endpoint.replace('/r2/buckets/', '/r2//buckets/'),
    ],
  ] as const)('rejects %s instead of normalizing it', (_description, endpoint) => {
    expect(cloudflareTopologyEndpointParts(endpoint)).toEqual([]);
    expect(
      verifyCloudflareTopologyEndpointFamily(endpoint, 'r2-custom-domain')
    ).toBe(false);
    expect(
      qualifyCloudflareTopologyEndpoint(
        { ...endpoints[2], endpoint },
        'account'
      ).ok
    ).toBe(false);
    expect(
      qualifyCloudflareTopologyEndpoints({
        endpoints: endpoints.map((candidate) =>
          candidate === endpoints[2] ? { ...candidate, endpoint } : candidate
        ),
      }).ok
    ).toBe(false);
    expect(
      qualifyCloudflareQualificationTopology(
        [endpoints[0], endpoints[1], { ...endpoints[2], endpoint }],
        'account'
      ).ok
    ).toBe(false);
  });
});
