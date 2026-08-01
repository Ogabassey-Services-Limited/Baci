import { describe, expect, it } from 'vitest';
import {
  type CloudflareQualificationClient,
  executeCloudflareEvidenceQualification,
} from './qualify-cloudflare-evidence-sources';
import {
  pointerProbeReadback,
  qualificationInput,
  readback,
} from './qualify-cloudflare-evidence-sources.test-fixtures';

const client = (
  overrides: Partial<Pick<CloudflareQualificationClient, 'pointerProbe'>> = {}
): CloudflareQualificationClient => ({
  listVersions: async () => ['a', 'b'],
  readVersion: async (_account, _script, versionId) => {
    const version = readback.versions.find(
      ({ versionId: expected }) => expected === versionId
    );
    if (!version) throw new Error('unexpected version');
    return version;
  },
  readDeployments: async () => readback.deployments,
  readZeroWeightContract: async () => readback.zeroWeightProof,
  readOrdinaryTrafficProof: async () =>
    readback.zeroWeightProof.ordinaryTraffic,
  readProtectedVersionOverrideProof: async () =>
    readback.zeroWeightProof.protectedOverride,
  trace: async () => ({
    matched: true,
    cacheRuleId: readback.pointerCache.cacheRuleId,
    rulesetVersion: readback.pointerCache.cacheRulesetVersion,
    expressionSha256: readback.pointerCache.traceExpressionSha256,
  }),
  pointerProbe: async () => pointerProbeReadback,
  readPurgeContract: async () => qualificationInput.purge,
  temporaryPurge: async () => ({ operationId: 'purge' }),
  readPurge: async () => 'complete',
  topologyConverged: async () => true,
  ...overrides,
});

describe('qualification pointer fixture binding', () => {
  it.each([
    ['status', { status: 404 }],
    [
      'bundle header',
      {
        headers: {
          ...pointerProbeReadback.headers,
          'X-Baci-Evidence-Bundle': 'unreviewed',
        },
      },
    ],
    [
      'Version Metadata header',
      {
        headers: {
          ...pointerProbeReadback.headers,
          'X-Baci-Evidence-Version': 'unreviewed',
        },
      },
    ],
  ] as const)('rejects a pointer probe with a mismatched %s', async (_field, change) => {
    await expect(
      executeCloudflareEvidenceQualification(
        client({
          pointerProbe: async () => ({ ...pointerProbeReadback, ...change }),
        }),
        qualificationInput
      )
    ).rejects.toThrow('reviewed qualification fixture');
  });
});
