import { chmod, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildClosedEvidenceProcessEnvironment,
  parseQualificationArguments,
  runQualificationCli,
} from './cloudflare-evidence-qualification-cli';
import {
  currentQualificationReadback,
  runQualificationValidation,
  writeCompletedQualificationJournal,
  writeValidationArtifacts,
} from './cloudflare-evidence-qualification-cli-test-support';

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
    const paths = await writeValidationArtifacts(
      directory,
      currentQualificationReadback()
    );
    const accepted = await runQualificationValidation(paths);
    expect(accepted.exitCode).toBeUndefined();
    expect(accepted.stderr).toBe('');
    expect(
      JSON.parse(accepted.stdout).zeroWeightProof.ownerAcceptance.approvalId
    ).toBe('owner-approval');

    const mismatch = await runQualificationValidation(
      paths,
      'different-owner-approval'
    );
    expect(mismatch.stdout).toBe('');
    expect(mismatch.stderr).toContain('owner_acceptance_mismatch');
    expect(mismatch.exitCode).toBe(1);
  });

  it('fails closed when the credentialless CLI has no authenticated owner authority seam', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'baci-qualification-cli-'));
    await chmod(directory, 0o700);
    const paths = await writeValidationArtifacts(
      directory,
      currentQualificationReadback()
    );
    await writeCompletedQualificationJournal(directory);
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
    const paths = await writeValidationArtifacts(
      directory,
      currentQualificationReadback()
    );
    await chmod(paths.artifactA, 0o644);

    const result = await runQualificationValidation(paths);

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
    const paths = await writeValidationArtifacts(
      directory,
      currentQualificationReadback()
    );
    const missingPath = join(directory, 'missing.json');

    const result = await runQualificationValidation(paths, 'owner-approval', {
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

    const result = await runQualificationValidation(paths);

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
