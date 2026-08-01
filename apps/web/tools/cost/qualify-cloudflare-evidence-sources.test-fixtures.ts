import {
  calculatePointerCacheCanonicalSha256,
  QUALIFICATION_POINTER_URL,
} from './qualify-cloudflare-evidence-sources';

export const readback = {
  apiFamily: 'scripts-versions',
  scriptName: 'baci-evidence-qualification' as const,
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
  deployments: {
    deploymentId: 'deployment',
    versions: [
      { versionId: 'a', percentage: 100 },
      { versionId: 'b', percentage: 0 },
    ],
  },
  pointerCache: {
    pointerUrl: QUALIFICATION_POINTER_URL,
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
    canonicalSha256: '',
  },
};
const { canonicalSha256: _ignored, ...withoutHash } = readback.pointerCache;
readback.pointerCache.canonicalSha256 =
  calculatePointerCacheCanonicalSha256(withoutHash);

export const reviewedArtifacts = readback.versions.map((version) => ({
  accountId: 'account',
  scriptName: readback.scriptName,
  versionId: version.versionId,
  scriptEtag: version.scriptEtag,
  moduleSha256: version.moduleSha256,
  settingsSha256: version.settingsSha256,
  artifactReceipt: {
    canonicalSourceSha256: version.scriptEtag,
    configSha256: version.settingsSha256,
    dependencyLockSha256: '1'.repeat(64),
    wranglerVersion: '4.115.0',
    generatedTypeSha256: '2'.repeat(64),
    moduleListSha256: version.moduleSha256,
    bundleSha256: version.scriptEtag,
    soleVersionMetadataBinding: 'CF_VERSION_METADATA' as const,
  } as const,
}));
