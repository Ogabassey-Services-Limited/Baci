import { describe, expect, it } from 'vitest';
import {
  ArtifactReadbackSchema,
  qualifyCloudflareEvidenceReadback,
  ReviewedQualificationArtifactSchema,
} from './cloudflare-evidence-qualification-schemas';
import {
  qualificationAuthorityOptions,
  readback,
  reviewedArtifactAuthority,
  reviewedArtifacts,
} from './qualify-cloudflare-evidence-sources.test-fixtures';

describe('cloudflare evidence qualification schemas', () => {
  it.each([
    ['bundleSha256', 'scriptEtag'],
    ['configSha256', 'settingsSha256'],
  ] as const)('binds nested %s to top-level %s', (nestedField) => {
    const artifact = reviewedArtifacts[0];
    const mismatched = {
      ...artifact,
      artifactReceipt: {
        ...artifact.artifactReceipt,
        [nestedField]: '0'.repeat(64),
      },
    };

    expect(
      ReviewedQualificationArtifactSchema.safeParse(mismatched).success
    ).toBe(false);
  });

  it('rejects provider module hashes that do not bind returned module bytes', () => {
    const changedModule = {
      ...readback.versions[0].modules[0],
      bytesBase64: 'dW5yZXZpZXdlZA==',
    };
    const tampered = {
      ...readback,
      versions: [
        { ...readback.versions[0], modules: [changedModule] },
        readback.versions[1],
      ],
    };

    expect(ArtifactReadbackSchema.safeParse(tampered).success).toBe(false);
  });

  it('rejects latest-state or suffixed endpoints instead of treating them as version readbacks', () => {
    expect(
      ArtifactReadbackSchema.safeParse({
        ...readback,
        versions: [
          {
            ...readback.versions[0],
            endpoint:
              '/accounts/account/workers/scripts/baci-evidence-qualification',
          },
          readback.versions[1],
        ],
      }).success
    ).toBe(false);
    expect(
      qualifyCloudflareEvidenceReadback(
        {
          ...readback,
          versions: [
            readback.versions[0],
            {
              ...readback.versions[1],
              endpoint: `${readback.versions[1].endpoint}/latest`,
            },
          ],
        },
        {
          now: new Date('2026-07-31T00:01:00.000Z'),
          expectedArtifacts: [reviewedArtifacts[0], reviewedArtifacts[1]],
          expectedScriptName: readback.scriptName,
          expectedAccountId: 'account',
          expectedOwnerApprovalId:
            readback.zeroWeightProof.ownerAcceptance.approvalId,
          ownerAcceptanceAuthority: () =>
            readback.zeroWeightProof.ownerAcceptance,
          ...qualificationAuthorityOptions,
        }
      ).ok
    ).toBe(false);
  });

  it('keeps provider module identity separate from the local module-list hash', () => {
    const artifact = reviewedArtifacts[0];
    expect(artifact.moduleSha256).not.toBe(artifact.moduleListSha256);
    expect(
      ReviewedQualificationArtifactSchema.safeParse(artifact).success
    ).toBe(true);
    expect(
      ReviewedQualificationArtifactSchema.safeParse({
        ...artifact,
        artifactReceipt: {
          ...artifact.artifactReceipt,
          moduleListSha256: '0'.repeat(64),
        },
      }).success
    ).toBe(false);
  });

  it('rejects a changed readback payload copied with the same measured binding', () => {
    const result = qualifyCloudflareEvidenceReadback(
      {
        ...readback,
        versions: [
          { ...readback.versions[0], scriptEtag: '0'.repeat(64) },
          readback.versions[1],
        ],
      },
      {
        now: new Date('2026-07-31T00:01:00.000Z'),
        expectedArtifacts: [reviewedArtifacts[0], reviewedArtifacts[1]],
        expectedScriptName: readback.scriptName,
        expectedAccountId: 'account',
        expectedOwnerApprovalId:
          readback.zeroWeightProof.ownerAcceptance.approvalId,
        ownerAcceptanceAuthority: () =>
          readback.zeroWeightProof.ownerAcceptance,
        expectedRunBinding: readback.runBinding,
        expectedArtifactAuthority: reviewedArtifactAuthority,
        expectedControlScope:
          qualificationAuthorityOptions.expectedControlScope,
      }
    );
    expect(result).toEqual({
      ok: false,
      reason: 'measurement_payload_mismatch',
    });
  });

  it('fails closed when exported callers omit run or artifact authority', () => {
    const base = {
      now: new Date('2026-07-31T00:01:00.000Z'),
      expectedArtifacts: [reviewedArtifacts[0], reviewedArtifacts[1]] as const,
      expectedScriptName: readback.scriptName,
      expectedAccountId: 'account',
      expectedOwnerApprovalId:
        readback.zeroWeightProof.ownerAcceptance.approvalId,
      ownerAcceptanceAuthority: () => readback.zeroWeightProof.ownerAcceptance,
      ...qualificationAuthorityOptions,
    };
    expect(
      qualifyCloudflareEvidenceReadback(readback, {
        ...base,
        expectedRunBinding: undefined as never,
      })
    ).toEqual({
      ok: false,
      reason: 'qualification_run_binding_required',
    });
    expect(
      qualifyCloudflareEvidenceReadback(readback, {
        ...base,
        expectedArtifactAuthority: undefined as never,
      })
    ).toEqual({
      ok: false,
      reason: 'reviewed_artifact_authority_required',
    });
    expect(
      qualifyCloudflareEvidenceReadback(readback, {
        ...base,
        expectedControlScope: undefined as never,
      })
    ).toEqual({
      ok: false,
      reason: 'control_evidence_scope_invalid',
    });
  });

  it('rejects caller artifact sidecars that do not match the reviewed authority', () => {
    const result = qualifyCloudflareEvidenceReadback(readback, {
      now: new Date('2026-07-31T00:01:00.000Z'),
      expectedArtifacts: [reviewedArtifacts[0], reviewedArtifacts[1]],
      expectedScriptName: readback.scriptName,
      expectedAccountId: 'account',
      expectedOwnerApprovalId:
        readback.zeroWeightProof.ownerAcceptance.approvalId,
      ownerAcceptanceAuthority: () => readback.zeroWeightProof.ownerAcceptance,
      expectedRunBinding: readback.runBinding,
      expectedArtifactAuthority: {
        ...reviewedArtifactAuthority,
        artifacts: [
          {
            ...reviewedArtifactAuthority.artifacts[0],
            artifactReceipt: {
              ...reviewedArtifactAuthority.artifacts[0].artifactReceipt,
              canonicalSourceSha256: 'f'.repeat(64),
            },
          },
          reviewedArtifactAuthority.artifacts[1],
        ],
      },
      expectedControlScope: qualificationAuthorityOptions.expectedControlScope,
    });
    expect(result).toEqual({
      ok: false,
      reason: 'reviewed_artifact_authority_mismatch',
    });
  });

  it('rejects a pointer cache tuple that is not in the reviewed authority', () => {
    const result = qualifyCloudflareEvidenceReadback(readback, {
      now: new Date('2026-07-31T00:01:00.000Z'),
      expectedArtifacts: [reviewedArtifacts[0], reviewedArtifacts[1]],
      expectedScriptName: readback.scriptName,
      expectedAccountId: 'account',
      expectedOwnerApprovalId:
        readback.zeroWeightProof.ownerAcceptance.approvalId,
      ownerAcceptanceAuthority: () => readback.zeroWeightProof.ownerAcceptance,
      expectedRunBinding: readback.runBinding,
      expectedArtifactAuthority: {
        ...reviewedArtifactAuthority,
        pointerCache: {
          ...reviewedArtifactAuthority.pointerCache,
          cacheRuleId: 'unreviewed-rule',
        },
      },
      expectedControlScope: qualificationAuthorityOptions.expectedControlScope,
    });
    expect(result).toEqual({
      ok: false,
      reason: 'pointer_cache_authority_mismatch',
    });
  });
});
