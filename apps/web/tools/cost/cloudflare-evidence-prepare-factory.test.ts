import { describe, expect, it, vi } from 'vitest';

const input = {
  runId: 'a'.repeat(32),
  approvalId: 'approval-123',
  policyId: 'policy-123',
  toolingMergeSha: '1'.repeat(40),
  writeTokenId: 'write-token-id',
  readTokenId: 'read-token-id',
  readPolicySha256: 'c'.repeat(64),
  accountId: 'account-id',
  zoneId: 'zone-id',
  plannedResources: [`baci-evidence-${'a'.repeat(32)}`],
  preInventorySha256: 'a'.repeat(64),
  expectedProbeCount: 2,
};

describe('cloudflareEvidencePrepare runner validation', () => {
  it('validates both reviewed runner factories before consuming approval', async () => {
    vi.resetModules();
    const events: string[] = [];
    const verifyPrepareAuthorityMock = vi.fn(async () => {
      events.push('authority');
      return {
        approvalId: input.approvalId,
        policyId: input.policyId,
        policySha256: 'b'.repeat(64),
        readPolicySha256: input.readPolicySha256,
      };
    });
    const openEvidenceRunMock = vi.fn(async () => {
      events.push('journal');
      return { runId: input.runId };
    });
    const execFileMock = (
      _command: string,
      args: readonly string[],
      callback: (
        error: null,
        result: { stdout: string; stderr: string }
      ) => void
    ) =>
      callback(null, {
        stdout: args.includes('rev-parse') ? input.toolingMergeSha : '',
        stderr: '',
      });
    vi.doMock('node:child_process', () => ({
      default: { execFile: execFileMock },
      execFile: execFileMock,
    }));
    vi.doMock('./cloudflare-evidence-merge-identity', () => ({
      loadProtectedMergeIdentityAuthority: vi.fn(async () => vi.fn()),
      readProtectedMergeIdentityAuthorityModuleDescriptor: vi.fn(() => ({
        path: '/workspace/authority.ts',
        sha256: 'd'.repeat(64),
      })),
      verifyProtectedMergeIdentityWithAuthority: vi.fn(async () => ({
        artifactManifestSha256: 'e'.repeat(64),
      })),
    }));
    vi.doMock('./cloudflare-evidence-prepare-authority', () => ({
      calculateReviewedPolicySha256: vi.fn(),
      readAuthorityArtifact: vi.fn(),
      verifyPrepareAuthority: verifyPrepareAuthorityMock,
    }));
    vi.doMock('./cloudflare-evidence-runner-modules', () => ({
      readEvidenceRunnerModuleDescriptor: vi.fn((_environment, kind) => ({
        path: `/workspace/${kind}.ts`,
        sha256: 'f'.repeat(64),
      })),
      verifyReviewedEvidenceRunnerModule: vi.fn(
        async (_workspaceRoot, _toolingMergeSha, descriptor) => ({
          ...descriptor,
          files: [],
        })
      ),
    }));
    vi.doMock('./cloudflare-evidence-reviewed-module-loader', () => ({
      importReviewedEvidenceModule: vi.fn(
        async (_workspaceRoot, entrypoint, _files, use) => {
          events.push(`factory:${entrypoint}`);
          return use(
            entrypoint.includes('measurement')
              ? {}
              : { createMutationDependencies: () => undefined }
          );
        }
      ),
    }));
    vi.doMock('./cloudflare-evidence-run-journal', () => ({
      REVIEWED_PROBE_COUNT: 2,
      openEvidenceRun: openEvidenceRunMock,
    }));

    const isolatedPrepare = await import('./cloudflare-evidence-prepare');
    await expect(
      isolatedPrepare.cloudflareEvidencePrepare.run(
        isolatedPrepare.cloudflareEvidencePrepare.argumentsFor(input),
        {
          EVIDENCE_RUN_STATE_DIR: '/state',
          EVIDENCE_WORKSPACE_ROOT: '/workspace',
          EVIDENCE_PROTECTED_MERGE_IDENTITY_ARTIFACT:
            '/workspace/identity.json',
        },
        vi.fn()
      )
    ).rejects.toThrow('measurement runner module is invalid');
    expect(events).toEqual([
      'factory:/workspace/mutation.ts',
      'factory:/workspace/measurement.ts',
    ]);
    expect(verifyPrepareAuthorityMock).not.toHaveBeenCalled();
    expect(openEvidenceRunMock).not.toHaveBeenCalled();
    vi.resetModules();
  });
});
