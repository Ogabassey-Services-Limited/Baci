import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmod, lstat, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it, vi } from 'vitest';
import { calculateReviewedPolicySha256 } from './cloudflare-evidence-prepare';
import { spawnIsolatedCloudflareEvidenceProcess } from './cloudflare-evidence-process-isolation';
import { openEvidenceRun } from './cloudflare-evidence-run-journal';

type Spawn = (
  executable: string,
  argv: readonly string[],
  options: { cwd: string; env: Record<string, string> }
) => Promise<void>;

describe('spawnIsolatedCloudflareEvidenceProcess', () => {
  const runId = 'b'.repeat(32);
  const prepareInput = {
    runId,
    approvalId: 'approval-123',
    policyId: 'policy-123',
    toolingMergeSha: '1'.repeat(40),
    writeTokenId: 'write-token-id',
    readTokenId: 'read-token-id',
    readPolicySha256: 'c'.repeat(64),
    accountId: 'account-id',
    zoneId: 'zone-id',
    plannedResources: [`baci-evidence-${runId}`],
    preInventorySha256: 'a'.repeat(64),
    expectedProbeCount: 2,
  };

  it('creates a private initial journal and prints only its bounded handoff', async () => {
    const workspaceRoot = resolve(import.meta.dirname, '../../../..');
    const { stdout: toolingMergeSha } = await promisify(execFile)('git', [
      '-C',
      workspaceRoot,
      'rev-parse',
      '--verify',
      'HEAD',
    ]);
    const reviewedPrepareInput = {
      ...prepareInput,
      toolingMergeSha: toolingMergeSha.trim(),
    };
    const runnerModulePath = resolve(
      workspaceRoot,
      'packages/shared/src/constants/countries.ts'
    );
    const runnerModuleSha256 = createHash('sha256')
      .update(await readFile(runnerModulePath))
      .digest('hex');
    const authorityDir = await mkdtemp(
      join(tmpdir(), 'baci-evidence-authority-')
    );
    await chmod(authorityDir, 0o700);
    const authorityNow = new Date();
    const approvedAt = new Date(
      authorityNow.valueOf() - 60 * 1000
    ).toISOString();
    const expiresAt = new Date(
      authorityNow.valueOf() + 60 * 60 * 1000
    ).toISOString();
    const policy = {
      id: reviewedPrepareInput.policyId,
      toolingMergeSha: reviewedPrepareInput.toolingMergeSha,
      tokenId: reviewedPrepareInput.writeTokenId,
      accountId: reviewedPrepareInput.accountId,
      zoneId: reviewedPrepareInput.zoneId,
      permissionGroupIds: ['workers.write'],
      resources: ['account'],
      expiresAt,
      policySha256: calculateReviewedPolicySha256({
        tokenId: reviewedPrepareInput.writeTokenId,
        accountId: reviewedPrepareInput.accountId,
        zoneId: reviewedPrepareInput.zoneId,
        permissionGroupIds: ['workers.write'],
        resources: ['account'],
        expiresAt,
      }),
    };
    const authority = {
      id: reviewedPrepareInput.approvalId,
      toolingMergeSha: reviewedPrepareInput.toolingMergeSha,
      policyId: reviewedPrepareInput.policyId,
      policySha256: policy.policySha256,
      readTokenId: reviewedPrepareInput.readTokenId,
      readPolicySha256: reviewedPrepareInput.readPolicySha256,
      approvedAt,
      expiresAt,
    };
    const approvalPath = join(authorityDir, 'approval.json');
    const policyPath = join(authorityDir, 'policy.json');
    await writeFile(approvalPath, JSON.stringify(authority), { mode: 0o600 });
    await writeFile(policyPath, JSON.stringify(policy), { mode: 0o600 });
    const stateDir = await mkdtemp(join(tmpdir(), 'baci-prepare-child-'));
    await chmod(stateDir, 0o700);
    let stdout = '';
    let stderr = '';
    const spawner = {
      spawn: async (
        executable: string,
        argv: readonly string[],
        options: { cwd: string; env: Record<string, string> }
      ) => {
        const result = await promisify(execFile)(
          executable,
          [...argv],
          options
        );
        stdout = result.stdout;
        stderr = result.stderr;
      },
    };
    await spawnIsolatedCloudflareEvidenceProcess(
      spawner,
      'prepare',
      reviewedPrepareInput.runId,
      {
        PATH: process.env.PATH ?? '',
        SECRET_THAT_MUST_NOT_ESCAPE: 'never-forward',
        CLOUDFLARE_WRITE_TOKEN: 'credential-must-not-escape',
        EVIDENCE_APPROVAL_ARTIFACT: approvalPath,
        EVIDENCE_POLICY_ARTIFACT: policyPath,
        EVIDENCE_MUTATION_RUNNER_MODULE: runnerModulePath,
        EVIDENCE_MUTATION_RUNNER_MODULE_SHA256: runnerModuleSha256,
        EVIDENCE_MEASUREMENT_RUNNER_MODULE: runnerModulePath,
        EVIDENCE_MEASUREMENT_RUNNER_MODULE_SHA256: runnerModuleSha256,
      },
      undefined,
      workspaceRoot,
      stateDir,
      reviewedPrepareInput
    );
    expect(stdout).toBe(
      `${JSON.stringify({ runId: reviewedPrepareInput.runId, nextPhase: 'mutate' })}\n`
    );
    const journalPath = join(stateDir, `${prepareInput.runId}.json`);
    const rawJournal = await readFile(journalPath, 'utf8');
    expect(JSON.parse(rawJournal)).toMatchObject({
      ...reviewedPrepareInput,
      policySha256: policy.policySha256,
      mutationRunnerModulePath: runnerModulePath,
      mutationRunnerModuleSha256: runnerModuleSha256,
      measurementRunnerModulePath: runnerModulePath,
      measurementRunnerModuleSha256: runnerModuleSha256,
      phase: 'prepared',
      cleanupAttempts: 0,
    });
    expect((await lstat(journalPath)).mode & 0o077).toBe(0);
    expect(`${stdout}${stderr}${rawJournal}`).not.toContain('never-forward');
    expect(`${stdout}${stderr}${rawJournal}`).not.toContain(
      'credential-must-not-escape'
    );
    await expect(
      spawnIsolatedCloudflareEvidenceProcess(
        spawner,
        'prepare',
        reviewedPrepareInput.runId,
        {
          PATH: process.env.PATH ?? '',
          EVIDENCE_APPROVAL_ARTIFACT: approvalPath,
          EVIDENCE_POLICY_ARTIFACT: policyPath,
          EVIDENCE_MUTATION_RUNNER_MODULE: runnerModulePath,
          EVIDENCE_MUTATION_RUNNER_MODULE_SHA256: runnerModuleSha256,
          EVIDENCE_MEASUREMENT_RUNNER_MODULE: runnerModulePath,
          EVIDENCE_MEASUREMENT_RUNNER_MODULE_SHA256: runnerModuleSha256,
        },
        undefined,
        workspaceRoot,
        stateDir,
        reviewedPrepareInput
      )
    ).rejects.toThrow('active');
  });

  it('uses separate children with one allowlisted credential and exact command ownership', async () => {
    const spawn = vi.fn<Spawn>(async () => undefined);
    const inherited = { PATH: '/bin', SECRET: 'never-forward' };
    const workspaceRoot = resolve(import.meta.dirname, '../../../..');
    const stateDir = await mkdtemp(join(tmpdir(), 'baci-evidence-isolation-'));
    await chmod(stateDir, 0o700);
    const { stdout: toolingMergeSha } = await promisify(execFile)('git', [
      '-C',
      workspaceRoot,
      'rev-parse',
      '--verify',
      'HEAD',
    ]);
    const runnerModulePath = resolve(
      workspaceRoot,
      'packages/shared/src/constants/countries.ts'
    );
    const runnerModuleSha256 = createHash('sha256')
      .update(await readFile(runnerModulePath))
      .digest('hex');
    await openEvidenceRun(stateDir, {
      ...prepareInput,
      toolingMergeSha: toolingMergeSha.trim(),
      mutationRunnerModulePath: runnerModulePath,
      mutationRunnerModuleSha256: runnerModuleSha256,
      measurementRunnerModulePath: runnerModulePath,
      measurementRunnerModuleSha256: runnerModuleSha256,
    });
    const attackerPath = '/tmp/attacker-runner.ts';
    const credentialInherited = {
      ...inherited,
      EVIDENCE_MUTATION_RUNNER_MODULE: attackerPath,
      EVIDENCE_MUTATION_RUNNER_MODULE_SHA256: 'f'.repeat(64),
      EVIDENCE_MEASUREMENT_RUNNER_MODULE: attackerPath,
      EVIDENCE_MEASUREMENT_RUNNER_MODULE_SHA256: 'f'.repeat(64),
    };
    await spawnIsolatedCloudflareEvidenceProcess(
      { spawn },
      'mutate',
      prepareInput.runId,
      credentialInherited,
      { name: 'CLOUDFLARE_WRITE_TOKEN', value: 'write' },
      workspaceRoot,
      stateDir
    );
    await spawnIsolatedCloudflareEvidenceProcess(
      { spawn },
      'cleanup',
      prepareInput.runId,
      credentialInherited,
      { name: 'CLOUDFLARE_WRITE_TOKEN', value: 'write' },
      workspaceRoot,
      stateDir
    );
    await spawnIsolatedCloudflareEvidenceProcess(
      { spawn },
      'measure',
      prepareInput.runId,
      credentialInherited,
      { name: 'CLOUDFLARE_READ_TOKEN', value: 'read' },
      workspaceRoot,
      stateDir
    );
    expect(spawn).toHaveBeenCalledTimes(3);
    expect(spawn.mock.calls.map(([, argv]) => argv)).toEqual([
      [
        `${workspaceRoot}/apps/web/tools/cost/mutate-cloudflare-evidence-sources.ts`,
        '--run',
        prepareInput.runId,
        '--apply',
      ],
      [
        `${workspaceRoot}/apps/web/tools/cost/mutate-cloudflare-evidence-sources.ts`,
        '--cleanup-run',
        prepareInput.runId,
      ],
      [
        `${workspaceRoot}/apps/web/tools/cost/measure-cloudflare-evidence-sources.ts`,
        '--run',
        prepareInput.runId,
      ],
    ]);
    for (const [executable, , options] of spawn.mock.calls) {
      expect(executable).toBe(`${workspaceRoot}/node_modules/.bin/tsx`);
      expect(options.env.EVIDENCE_RUN_STATE_DIR).toBe(stateDir);
    }
    for (const [, , { env }] of spawn.mock.calls.slice(0, 2)) {
      expect(env.SECRET).toBeUndefined();
      expect(env.EVIDENCE_MUTATION_RUNNER_MODULE).toBe(runnerModulePath);
      expect(env.EVIDENCE_MUTATION_RUNNER_MODULE_SHA256).toBe(
        runnerModuleSha256
      );
      expect(
        Object.keys(env).filter((key) => key.includes('TOKEN'))
      ).toHaveLength(
        env.CLOUDFLARE_WRITE_TOKEN || env.CLOUDFLARE_READ_TOKEN ? 1 : 0
      );
    }
    const measureEnvironment = spawn.mock.calls[2]?.[2].env;
    expect(measureEnvironment.EVIDENCE_MEASUREMENT_RUNNER_MODULE).toBe(
      runnerModulePath
    );
    expect(measureEnvironment.EVIDENCE_MEASUREMENT_RUNNER_MODULE_SHA256).toBe(
      runnerModuleSha256
    );
    expect(measureEnvironment.EVIDENCE_MUTATION_RUNNER_MODULE).toBeUndefined();
  });
});
