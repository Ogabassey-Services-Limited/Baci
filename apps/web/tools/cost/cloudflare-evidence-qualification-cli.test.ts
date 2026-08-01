import { chmod, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildClosedEvidenceProcessEnvironment,
  parseQualificationArguments,
  runQualificationCli,
} from './cloudflare-evidence-qualification-cli';
import { calculatePointerCacheCanonicalSha256 } from './cloudflare-evidence-qualification-schemas';
import {
  readback,
  reviewedArtifacts,
} from './qualify-cloudflare-evidence-sources.test-fixtures';

const validateReadbackArguments = [
  '--validate-readback',
  '/tmp/receipt.json',
  '--expected-artifact-a',
  '/tmp/a.json',
  '--expected-artifact-b',
  '/tmp/b.json',
  '--script-name',
  'baci-evidence-qualification',
  '--expected-owner-approval-id',
  'owner-approval',
  '--run-state-dir',
  '/tmp/evidence-state',
  '--run-id',
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
] as const;

function currentReadback() {
  const qualifiedAt = new Date(Date.now() - 1000).toISOString();
  const expiresAt = new Date(Date.now() + 60_000).toISOString();
  const pointerCache = {
    ...readback.pointerCache,
    qualifiedAt,
    expiresAt,
    canonicalSha256: '',
  };
  const { canonicalSha256: _ignored, ...withoutHash } = pointerCache;
  pointerCache.canonicalSha256 =
    calculatePointerCacheCanonicalSha256(withoutHash);
  return {
    ...readback,
    zeroWeightProof: {
      ...readback.zeroWeightProof,
      ownerAcceptance: {
        ...readback.zeroWeightProof.ownerAcceptance,
        acceptedAt: new Date(Date.now() - 1000).toISOString(),
      },
    },
    pointerCache,
  };
}

async function writeValidationArtifacts(directory: string, receipt: unknown) {
  const paths = {
    receipt: join(directory, 'readback.json'),
    artifactA: join(directory, 'artifact-a.json'),
    artifactB: join(directory, 'artifact-b.json'),
    ownerAcceptance: join(directory, 'owner-acceptance.json'),
  };
  const ownerAcceptance =
    (
      receipt as {
        zeroWeightProof?: { ownerAcceptance?: unknown };
      }
    ).zeroWeightProof?.ownerAcceptance ??
    readback.zeroWeightProof.ownerAcceptance;
  await Promise.all([
    writeFile(paths.receipt, JSON.stringify(receipt), { mode: 0o600 }),
    writeFile(paths.artifactA, JSON.stringify(reviewedArtifacts[0]), {
      mode: 0o600,
    }),
    writeFile(paths.ownerAcceptance, JSON.stringify(ownerAcceptance), {
      mode: 0o600,
    }),
    writeFile(paths.artifactB, JSON.stringify(reviewedArtifacts[1]), {
      mode: 0o600,
    }),
  ]);
  return {
    ...paths,
    ownerAcceptance:
      ownerAcceptance as typeof readback.zeroWeightProof.ownerAcceptance,
  };
}

async function writeCompletedJournal(directory: string) {
  const stateDir = join(directory, 'state');
  await mkdir(stateDir, { mode: 0o700, recursive: true });
  const runId = 'a'.repeat(32);
  const observedAt = new Date(Date.now() - 1000).toISOString();
  const runBinding = readback.runBinding;
  await writeFile(
    join(stateDir, `${runId}.json`),
    JSON.stringify({
      runId,
      phase: 'proof_complete',
      toolingMergeSha: runBinding.toolingMergeSha,
      cleanupVerifiedAt: observedAt,
      measurementVerifiedAt: observedAt,
      cleanupVerificationReceiptSha256:
        runBinding.cleanupVerificationReceiptSha256,
      measurementReceiptSha256: runBinding.measurementReceiptSha256,
      writeTokenId: 'write-token',
      readTokenId: 'read-token',
      writeTokenRevocationReceipt: {
        tokenId: 'write-token',
        status: 'revoked',
        providerReceiptSha256: 'a'.repeat(64),
        observedAt,
      },
      readTokenRevocationReceipt: {
        tokenId: 'read-token',
        status: 'revoked',
        providerReceiptSha256: 'b'.repeat(64),
        observedAt,
      },
    }),
    { mode: 0o600 }
  );
  return { stateDir, runId };
}

type ValidationPaths = Awaited<ReturnType<typeof writeValidationArtifacts>>;

async function runValidation(
  paths: ValidationPaths,
  expectedOwnerApprovalId = 'owner-approval',
  overrides: Partial<ValidationPaths> = {}
) {
  const resolvedPaths = { ...paths, ...overrides };
  const { stateDir, runId } = await writeCompletedJournal(
    resolvedPaths.receipt.slice(0, resolvedPaths.receipt.lastIndexOf('/'))
  );
  let stdout = '';
  let stderr = '';
  let exitCode: number | undefined;
  await runQualificationCli(
    [
      '--validate-readback',
      resolvedPaths.receipt,
      '--expected-artifact-a',
      resolvedPaths.artifactA,
      '--expected-artifact-b',
      resolvedPaths.artifactB,
      '--script-name',
      'baci-evidence-qualification',
      '--expected-owner-approval-id',
      expectedOwnerApprovalId,
      '--run-state-dir',
      stateDir,
      '--run-id',
      runId,
    ],
    {
      EVIDENCE_OWNER_ACCEPTANCE_ARTIFACT: resolvedPaths.ownerAcceptance,
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
    },
    () => paths.ownerAcceptance
  );
  return { stdout, stderr, exitCode };
}

describe('qualification CLI helpers', () => {
  it('requires both reviewed sidecars and the script name', () => {
    expect(parseQualificationArguments(validateReadbackArguments)).toEqual({
      mode: 'validate-readback',
      receiptPath: '/tmp/receipt.json',
      expectedArtifactPaths: ['/tmp/a.json', '/tmp/b.json'],
      scriptName: 'baci-evidence-qualification',
      expectedOwnerApprovalId: 'owner-approval',
      runStateDir: '/tmp/evidence-state',
      runId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    });
  });

  it('requires a bounded owner-reviewed approval ID', () => {
    expect(() =>
      parseQualificationArguments(
        validateReadbackArguments
          .slice(0, -2)
          .concat(['--expected-owner-approval-id', 'owner approval'])
      )
    ).toThrow('owner-reviewed-approval-id');
    expect(() =>
      parseQualificationArguments(
        validateReadbackArguments
          .slice(0, -2)
          .concat(['--expected-owner-approval-id', 'a'.repeat(129)])
      )
    ).toThrow('owner-reviewed-approval-id');
  });

  it('accepts private 0600 artifacts only when owner acceptance matches', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'baci-qualification-cli-'));
    await chmod(directory, 0o700);
    const paths = await writeValidationArtifacts(directory, currentReadback());
    const accepted = await runValidation(paths);
    expect(accepted.exitCode).toBeUndefined();
    expect(accepted.stderr).toBe('');
    expect(
      JSON.parse(accepted.stdout).zeroWeightProof.ownerAcceptance.approvalId
    ).toBe('owner-approval');

    const mismatch = await runValidation(paths, 'different-owner-approval');
    expect(mismatch.stdout).toBe('');
    expect(mismatch.stderr).toContain('owner_acceptance_mismatch');
    expect(mismatch.exitCode).toBe(1);
  });

  it('fails closed when the credentialless CLI has no authenticated owner authority seam', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'baci-qualification-cli-'));
    await chmod(directory, 0o700);
    const paths = await writeValidationArtifacts(directory, currentReadback());
    await writeCompletedJournal(directory);
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
        join(directory, 'state'),
        '--run-id',
        'a'.repeat(32),
      ],
      {},
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
      'independently authenticated owner acceptance readback is required\n'
    );
    expect(exitCode).toBe(1);
  });

  it('rejects a reviewed artifact with permissions broader than 0600', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'baci-qualification-cli-'));
    await chmod(directory, 0o700);
    const paths = await writeValidationArtifacts(directory, currentReadback());
    await chmod(paths.artifactA, 0o644);

    const result = await runValidation(paths);

    expect(result.stdout).toBe('');
    expect(result.stderr).toBe(
      'expected artifact 1 artifact must be a private regular file\n'
    );
    expect(result.stderr).not.toContain(paths.artifactA);
    expect(result.exitCode).toBe(1);
  });

  it('redacts filesystem errors when a reviewed artifact cannot be opened', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'baci-qualification-cli-'));
    await chmod(directory, 0o700);
    const paths = await writeValidationArtifacts(directory, currentReadback());
    const missingPath = join(directory, 'missing.json');

    const result = await runValidation(paths, 'owner-approval', {
      artifactA: missingPath,
    });

    expect(result.stdout).toBe('');
    expect(result.stderr).toBe(
      'expected artifact 1 artifact is not readable\n'
    );
    expect(result.stderr).not.toContain(missingPath);
    expect(result.exitCode).toBe(1);
  });

  it('sets a failing exit code for an invalid readback receipt', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'baci-qualification-cli-'));
    await chmod(directory, 0o700);
    const paths = await writeValidationArtifacts(directory, { invalid: true });

    const result = await runValidation(paths);

    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('readback_schema_invalid\n');
    expect(result.exitCode).toBe(1);
  });

  it('does not forward inherited Cloudflare credentials', () => {
    expect(() =>
      buildClosedEvidenceProcessEnvironment('CLOUDFLARE_READ_TOKEN', 'read', {
        CLOUDFLARE_WRITE_TOKEN: 'write',
      })
    ).toThrow('evidence process inherited a credential');
  });
});
