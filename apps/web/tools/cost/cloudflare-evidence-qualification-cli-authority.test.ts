import { chmod, mkdir, mkdtemp, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { calculateQualificationEvidencePayloadSha256 } from './cloudflare-evidence-qualification-artifact';
import { runQualificationCli } from './cloudflare-evidence-qualification-cli';
import {
  createReviewedQualificationAuthority,
  currentQualificationReadback,
  writeCompletedQualificationJournal,
  writeValidationArtifacts,
} from './cloudflare-evidence-qualification-cli-test-support';
import { reviewedArtifacts } from './qualify-cloudflare-evidence-sources.test-fixtures';

describe('qualification CLI owner authority wiring', () => {
  it('loads owner acceptance from the reviewed authority module at process entry', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'baci-qualification-cli-'));
    await chmod(directory, 0o700);
    const receipt = currentQualificationReadback();
    const workspaceRoot = join(directory, 'workspace');
    await mkdir(workspaceRoot, { mode: 0o700 });
    const canonicalWorkspaceRoot = await realpath(workspaceRoot);
    const authority = await createReviewedQualificationAuthority(
      canonicalWorkspaceRoot,
      receipt.zeroWeightProof.ownerAcceptance
    );
    const reboundBinding = {
      ...receipt.runBinding,
      toolingMergeSha: authority.toolingMergeSha,
      measurementPayloadSha256: '0'.repeat(64),
    };
    const reboundArtifacts = reviewedArtifacts.map((artifact) => ({
      ...artifact,
      runBinding: reboundBinding,
    }));
    reboundBinding.measurementPayloadSha256 =
      calculateQualificationEvidencePayloadSha256(
        { ...receipt, runBinding: reboundBinding },
        reboundArtifacts
      );
    const reboundReceipt = { ...receipt, runBinding: reboundBinding };
    const paths = await writeValidationArtifacts(directory, reboundReceipt);
    const { stateDir, runId } = await writeCompletedQualificationJournal(
      directory,
      reboundReceipt.runBinding
    );
    let stdout = '';
    let stderr = '';
    let exitCode: number | undefined;
    const previousToolingSha = process.env.EVIDENCE_TOOLING_MERGE_SHA;
    process.env.EVIDENCE_TOOLING_MERGE_SHA = authority.toolingMergeSha;
    try {
      await runQualificationCli(
        [
          '--validate-readback',
          paths.receipt,
          '--expected-artifact-a',
          paths.artifactA,
          '--expected-artifact-b',
          paths.artifactB,
          '--script-name',
          'baci-evidence-qualification',
          '--expected-owner-approval-id',
          'owner-approval',
          '--run-state-dir',
          stateDir,
          '--run-id',
          runId,
        ],
        {
          EVIDENCE_WORKSPACE_ROOT: canonicalWorkspaceRoot,
          EVIDENCE_TOOLING_MERGE_SHA: authority.toolingMergeSha,
          EVIDENCE_OWNER_ACCEPTANCE_AUTHORITY_MODULE: authority.path,
          EVIDENCE_OWNER_ACCEPTANCE_AUTHORITY_MODULE_SHA256: authority.sha256,
          EVIDENCE_ARTIFACT_AUTHORITY_MODULE: authority.path,
          EVIDENCE_ARTIFACT_AUTHORITY_MODULE_SHA256: authority.sha256,
        },
        {
          stdout: (value) => {
            stdout += value;
          },
          stderr: (value) => {
            stderr += value;
          },
          setExitCode: (code) => {
            exitCode = code;
          },
        }
      );
    } finally {
      if (previousToolingSha === undefined)
        delete process.env.EVIDENCE_TOOLING_MERGE_SHA;
      else process.env.EVIDENCE_TOOLING_MERGE_SHA = previousToolingSha;
    }
    expect(exitCode, stderr).toBeUndefined();
    expect(stderr).toBe('');
    expect(JSON.parse(stdout).zeroWeightProof.ownerAcceptance.approvalId).toBe(
      'owner-approval'
    );
  });

  it.each([
    'CLOUDFLARE_WRITE_TOKEN',
    'CLOUDFLARE_READ_TOKEN',
  ] as const)('rejects %s before loading owner authority or reviewed artifacts', async (credentialName) => {
    const directory = await mkdtemp(join(tmpdir(), 'baci-qualification-cli-'));
    await chmod(directory, 0o700);
    const receipt = currentQualificationReadback();
    const paths = await writeValidationArtifacts(directory, receipt);
    const { stateDir, runId } = await writeCompletedQualificationJournal(
      directory,
      receipt.runBinding
    );
    const workspaceRoot = join(directory, 'workspace');
    await mkdir(workspaceRoot, { mode: 0o700 });
    const canonicalWorkspaceRoot = await realpath(workspaceRoot);
    const authority = await createReviewedQualificationAuthority(
      canonicalWorkspaceRoot,
      receipt.zeroWeightProof.ownerAcceptance
    );
    let stderr = '';
    let exitCode: number | undefined;
    await runQualificationCli(
      [
        '--validate-readback',
        paths.receipt,
        '--expected-artifact-a',
        paths.artifactA,
        '--expected-artifact-b',
        paths.artifactB,
        '--script-name',
        'baci-evidence-qualification',
        '--expected-owner-approval-id',
        'owner-approval',
        '--run-state-dir',
        stateDir,
        '--run-id',
        runId,
      ],
      {
        EVIDENCE_WORKSPACE_ROOT: canonicalWorkspaceRoot,
        EVIDENCE_TOOLING_MERGE_SHA: authority.toolingMergeSha,
        EVIDENCE_OWNER_ACCEPTANCE_AUTHORITY_MODULE: authority.path,
        EVIDENCE_OWNER_ACCEPTANCE_AUTHORITY_MODULE_SHA256: authority.sha256,
        [credentialName]: 'provider-token',
      },
      {
        stdout: () => undefined,
        stderr: (value) => {
          stderr += value;
        },
        setExitCode: (code) => {
          exitCode = code;
        },
      }
    );
    expect(stderr).toBe(
      'validate-readback must not receive a Cloudflare credential\n'
    );
    expect(exitCode).toBe(1);
  });
});
