import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmod, mkdir, mkdtemp, realpath, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { runQualificationCli } from './cloudflare-evidence-qualification-cli';
import { calculatePointerCacheCanonicalSha256 } from './cloudflare-evidence-qualification-schemas';
import {
  readback,
  reviewedArtifacts,
} from './qualify-cloudflare-evidence-sources.test-fixtures';

const execFileAsync = promisify(execFile);

function currentReadback() {
  const pointerCache = {
    ...readback.pointerCache,
    qualifiedAt: new Date(Date.now() - 1000).toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
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

async function writeArtifacts(
  directory: string,
  receipt: ReturnType<typeof currentReadback>
) {
  const paths = {
    receipt: join(directory, 'readback.json'),
    artifactA: join(directory, 'artifact-a.json'),
    artifactB: join(directory, 'artifact-b.json'),
  };
  await Promise.all([
    writeFile(paths.receipt, JSON.stringify(receipt), { mode: 0o600 }),
    writeFile(paths.artifactA, JSON.stringify(reviewedArtifacts[0]), {
      mode: 0o600,
    }),
    writeFile(paths.artifactB, JSON.stringify(reviewedArtifacts[1]), {
      mode: 0o600,
    }),
  ]);
  return paths;
}

async function createReviewedAuthority(
  workspaceRoot: string,
  acceptance: ReturnType<
    typeof currentReadback
  >['zeroWeightProof']['ownerAcceptance']
) {
  const modulePath = join(workspaceRoot, 'owner-acceptance-authority.mjs');
  const source = `export function resolveOwnerAcceptanceAuthority() { return ${JSON.stringify(acceptance)}; }\n`;
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
  const sourceSha256 = createHash('sha256').update(source).digest('hex');
  return {
    path: modulePath,
    sha256: sourceSha256,
    toolingMergeSha: stdout.trim(),
  };
}

describe('qualification CLI owner authority wiring', () => {
  it('loads owner acceptance from the reviewed authority module at process entry', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'baci-qualification-cli-'));
    await chmod(directory, 0o700);
    const receipt = currentReadback();
    const paths = await writeArtifacts(directory, receipt);
    const workspaceRoot = join(directory, 'workspace');
    await mkdir(workspaceRoot, { mode: 0o700 });
    const canonicalWorkspaceRoot = await realpath(workspaceRoot);
    const authority = await createReviewedAuthority(
      canonicalWorkspaceRoot,
      receipt.zeroWeightProof.ownerAcceptance
    );
    let stdout = '';
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
      ],
      {
        EVIDENCE_WORKSPACE_ROOT: canonicalWorkspaceRoot,
        EVIDENCE_TOOLING_MERGE_SHA: authority.toolingMergeSha,
        EVIDENCE_OWNER_ACCEPTANCE_AUTHORITY_MODULE: authority.path,
        EVIDENCE_OWNER_ACCEPTANCE_AUTHORITY_MODULE_SHA256: authority.sha256,
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
    expect(exitCode).toBeUndefined();
    expect(stderr).toBe('');
    expect(JSON.parse(stdout).zeroWeightProof.ownerAcceptance.approvalId).toBe(
      'owner-approval'
    );
  });
});
