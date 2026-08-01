import { calculateQualificationArtifactModuleListSha256 } from './cloudflare-evidence-qualification-artifact';
import {
  calculatePointerCacheCanonicalSha256,
  QUALIFICATION_POINTER_URL,
} from './qualify-cloudflare-evidence-sources';

const modulesA = [
  { name: 'src/version-a.ts', bytesBase64: 'bW9kdWxlLWE=' },
] as const;
const modulesB = [
  { name: 'src/version-b.ts', bytesBase64: 'bW9kdWxlLWI=' },
] as const;

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
      modules: modulesA,
      moduleListSha256:
        calculateQualificationArtifactModuleListSha256(modulesA),
      settingsSha256: 'c'.repeat(64),
    },
    {
      versionId: 'b',
      endpoint:
        '/accounts/account/workers/scripts/baci-evidence-qualification/versions/b',
      scriptEtag: 'd'.repeat(64),
      moduleSha256: 'e'.repeat(64),
      modules: modulesB,
      moduleListSha256:
        calculateQualificationArtifactModuleListSha256(modulesB),
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
  zeroWeightProof: {
    zeroWeightDeploymentSupported: true,
    zeroWeightOpenApiContradiction: true,
    productDocumentSha256: '1'.repeat(64),
    openApiSha256: '2'.repeat(64),
    openApiMinimumWeight: 0.01,
    visibilityBoundSeconds: 60,
    deployment: {
      deploymentId: 'deployment',
      versions: [
        { versionId: 'a', percentage: 100 },
        { versionId: 'b', percentage: 0 },
      ],
    },
    ordinaryTraffic: {
      requestSha256: '3'.repeat(64),
      responseSha256: '4'.repeat(64),
      requestCount: 4,
      aInvocationCount: 4,
      bInvocationCount: 0,
      visibilityBoundSeconds: 60,
    },
    protectedOverride: {
      requestSha256: '5'.repeat(64),
      responseSha256: '6'.repeat(64),
      requestCount: 1,
      servedVersionId: 'b',
      versionMetadataVersionId: 'b',
      visibilityBoundSeconds: 60,
    },
    ownerAcceptance: {
      accepted: true,
      approvalId: 'owner-approval',
      acceptedAt: '2026-07-31T00:00:00.000Z',
      receiptSha256: '7'.repeat(64),
    },
  } as const,
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
  runBinding: {
    runId: 'a'.repeat(32),
    toolingMergeSha: '1'.repeat(40),
    cleanupVerificationReceiptSha256: '8'.repeat(64),
    measurementReceiptSha256: '9'.repeat(64),
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
  modules: version.modules,
  moduleListSha256: version.moduleListSha256,
  settingsSha256: version.settingsSha256,
  artifactReceipt: {
    canonicalSourceSha256: version.scriptEtag,
    configSha256: version.settingsSha256,
    dependencyLockSha256: '1'.repeat(64),
    wranglerVersion: '4.115.0',
    generatedTypeSha256: '2'.repeat(64),
    moduleListSha256: version.moduleListSha256,
    bundleSha256: version.scriptEtag,
    soleVersionMetadataBinding: 'CF_VERSION_METADATA' as const,
  } as const,
  runBinding: readback.runBinding,
}));

export const pointerProbeReadback = {
  status: 204,
  cfCacheStatus: 'DYNAMIC',
  headers: {
    'X-Baci-Evidence-Bundle': 'version-a-204',
    'X-Baci-Evidence-Version': 'a',
  },
} as const;

export const qualificationInput = {
  accountId: 'account',
  scriptName: readback.scriptName,
  artifacts: [readback.versions[0], readback.versions[1]] as const,
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
  topology: [
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
  ] as const,
  zoneId: 'zone',
  ownerAcceptance: readback.zeroWeightProof.ownerAcceptance,
  ownerAcceptanceAuthority: () => readback.zeroWeightProof.ownerAcceptance,
  expectedOwnerApprovalId: 'owner-approval',
  now: new Date('2026-07-31T01:00:00.000Z'),
  trace: {
    cacheRuleId: readback.pointerCache.cacheRuleId,
    rulesetVersion: readback.pointerCache.cacheRulesetVersion,
    expressionSha256: readback.pointerCache.traceExpressionSha256,
  },
};
