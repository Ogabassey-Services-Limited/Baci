import { chmod, mkdtemp, writeFile } from 'node:fs/promises';
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
  return { ...readback, pointerCache };
}

async function writeValidationArtifacts(directory: string, receipt: unknown) {
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

describe('qualification CLI helpers', () => {
  it('requires both reviewed sidecars and the script name', () => {
    expect(parseQualificationArguments(validateReadbackArguments)).toEqual({
      mode: 'validate-readback',
      receiptPath: '/tmp/receipt.json',
      expectedArtifactPaths: ['/tmp/a.json', '/tmp/b.json'],
      scriptName: 'baci-evidence-qualification',
      expectedOwnerApprovalId: 'owner-approval',
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

  it('emits readback only when owner acceptance matches the reviewed approval ID', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'baci-qualification-cli-'));
    await chmod(directory, 0o700);
    const paths = await writeValidationArtifacts(directory, currentReadback());
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
      {},
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

    stdout = '';
    stderr = '';
    exitCode = undefined;
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
        'different-owner-approval',
      ],
      {},
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
    expect(stdout).toBe('');
    expect(stderr).toContain('owner_acceptance_mismatch');
    expect(exitCode).toBe(1);
  });

  it('does not forward inherited Cloudflare credentials', () => {
    expect(() =>
      buildClosedEvidenceProcessEnvironment('CLOUDFLARE_READ_TOKEN', 'read', {
        CLOUDFLARE_WRITE_TOKEN: 'write',
      })
    ).toThrow('evidence process inherited a credential');
  });
});
