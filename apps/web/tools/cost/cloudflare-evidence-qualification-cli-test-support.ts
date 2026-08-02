import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import {
  calculatePointerCacheCanonicalSha256,
  calculateQualificationEvidencePayloadSha256,
} from './cloudflare-evidence-qualification-artifact';
import { runQualificationCli } from './cloudflare-evidence-qualification-cli';
import {
  readback,
  reviewedArtifactAuthority,
  reviewedArtifacts,
} from './qualify-cloudflare-evidence-sources.test-fixtures';

const execFileAsync = promisify(execFile);

export function currentQualificationReadback() {
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
  const result = {
    ...readback,
    zeroWeightProof: {
      ...readback.zeroWeightProof,
      ownerAcceptance: {
        ...readback.zeroWeightProof.ownerAcceptance,
        acceptedAt: new Date(Date.now() - 1000).toISOString(),
      },
    },
    pointerCache,
    runBinding: {
      ...readback.runBinding,
      measurementPayloadSha256: '0'.repeat(64),
    },
  };
  const artifacts = reviewedArtifacts.map((artifact) => ({
    ...artifact,
    runBinding: result.runBinding,
  }));
  result.runBinding.measurementPayloadSha256 =
    calculateQualificationEvidencePayloadSha256(result, artifacts);
  return result;
}

export async function writeValidationArtifacts(
  directory: string,
  receipt: unknown
) {
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
  const runBinding =
    (receipt as { runBinding?: typeof readback.runBinding }).runBinding ??
    readback.runBinding;
  await Promise.all([
    writeFile(paths.receipt, JSON.stringify(receipt), { mode: 0o600 }),
    writeFile(
      paths.artifactA,
      JSON.stringify({ ...reviewedArtifacts[0], runBinding }),
      { mode: 0o600 }
    ),
    writeFile(paths.ownerAcceptance, JSON.stringify(ownerAcceptance), {
      mode: 0o600,
    }),
    writeFile(
      paths.artifactB,
      JSON.stringify({ ...reviewedArtifacts[1], runBinding }),
      { mode: 0o600 }
    ),
  ]);
  return {
    ...paths,
    ownerAcceptance:
      ownerAcceptance as typeof readback.zeroWeightProof.ownerAcceptance,
    runBinding,
  };
}

export async function writeCompletedQualificationJournal(
  directory: string,
  runBinding = readback.runBinding
) {
  const stateDir = join(directory, 'state');
  await mkdir(stateDir, { mode: 0o700, recursive: true });
  const runId = 'a'.repeat(32);
  const observedAt = new Date(Date.now() - 1000).toISOString();
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
      measurementPayloadSha256: runBinding.measurementPayloadSha256,
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

export async function createReviewedQualificationAuthority(
  workspaceRoot: string,
  acceptance: ReturnType<
    typeof currentQualificationReadback
  >['zeroWeightProof']['ownerAcceptance']
) {
  const modulePath = join(workspaceRoot, 'owner-acceptance-authority.mjs');
  const artifactAuthority = {
    pointerCache: reviewedArtifactAuthority.pointerCache,
    artifacts: reviewedArtifactAuthority.artifacts,
  };
  const source = `export function resolveOwnerAcceptanceAuthority() { return ${JSON.stringify(acceptance)}; }\nexport function resolveQualificationArtifactAuthority() { return { toolingMergeSha: process.env.EVIDENCE_TOOLING_MERGE_SHA, ...${JSON.stringify(artifactAuthority)} }; }\n`;
  await writeFile(modulePath, source, { mode: 0o600 });
  await execFileAsync('git', [
    '-C',
    workspaceRoot,
    '-c',
    'init.defaultBranch=main',
    'init',
    '--quiet',
  ]);
  await execFileAsync('git', ['-C', workspaceRoot, 'add', '--', '.']);
  await execFileAsync('git', [
    '-C',
    workspaceRoot,
    '-c',
    'user.email=baci-test@example.invalid',
    '-c',
    'user.name=Baci Test Fixture',
    '-c',
    'commit.gpgsign=false',
    '-c',
    'core.hooksPath=/dev/null',
    'commit',
    '--quiet',
    '-m',
    'fixture',
  ]);
  const { stdout } = await execFileAsync('git', [
    '-C',
    workspaceRoot,
    'rev-parse',
    'HEAD',
  ]);
  return {
    path: modulePath,
    sha256: createHash('sha256').update(source).digest('hex'),
    toolingMergeSha: stdout.trim(),
  };
}

export type QualificationValidationPaths = Awaited<
  ReturnType<typeof writeValidationArtifacts>
>;

export async function runQualificationValidation(
  paths: QualificationValidationPaths,
  expectedOwnerApprovalId = 'owner-approval',
  overrides: Partial<QualificationValidationPaths> = {}
) {
  const resolvedPaths = { ...paths, ...overrides };
  const { stateDir, runId } = await writeCompletedQualificationJournal(
    resolvedPaths.receipt.slice(0, resolvedPaths.receipt.lastIndexOf('/')),
    resolvedPaths.runBinding
  );
  const ownerAcceptancePath = join(
    resolvedPaths.receipt.slice(0, resolvedPaths.receipt.lastIndexOf('/')),
    'owner-acceptance.json'
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
    { EVIDENCE_OWNER_ACCEPTANCE_ARTIFACT: ownerAcceptancePath },
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
    () => resolvedPaths.ownerAcceptance,
    reviewedArtifactAuthority
  );
  return { stdout, stderr, exitCode };
}
