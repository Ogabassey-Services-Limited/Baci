export const pointerProbeReadback = {
  status: 204,
  cfCacheStatus: 'DYNAMIC',
  headers: {
    'X-Baci-Evidence-Bundle': 'version-a-204',
    'X-Baci-Evidence-Version': 'a',
  },
} as const;

export const qualificationTopology = [
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

export const reviewedZeroWeightRequestMatrix = {
  ordinaryRequestSha256: '3'.repeat(64),
  ordinaryResponseSha256: '4'.repeat(64),
  ordinaryRequestCount: 4,
  protectedOverrideRequestSha256: '5'.repeat(64),
  protectedOverrideResponseSha256: '6'.repeat(64),
  protectedOverrideRequestCount: 1,
} as const;
