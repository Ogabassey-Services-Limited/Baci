import { execFile } from 'node:child_process';
import { chmod, lstat, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it, vi } from 'vitest';
import { spawnIsolatedCloudflareEvidenceProcess } from './cloudflare-evidence-process-isolation';

describe('spawnIsolatedCloudflareEvidenceProcess', () => {
  const prepareInput = {
    runId: 'run-child-123',
    approvalId: 'approval-123',
    policyId: 'policy-123',
    toolingMergeSha: '1'.repeat(40),
    writeTokenId: 'write-token-id',
    readTokenId: 'read-token-id',
    accountId: 'account-id',
    zoneId: 'zone-id',
    plannedResources: ['baci-evidence-run-child-123'],
    preInventorySha256: 'a'.repeat(64),
    expectedProbeCount: 2,
  };
  const prepareArguments = [
    '--prepare',
    '--run-id',
    prepareInput.runId,
    '--approval-id',
    prepareInput.approvalId,
    '--policy-id',
    prepareInput.policyId,
    '--tooling-merge-sha',
    prepareInput.toolingMergeSha,
    '--write-token-id',
    prepareInput.writeTokenId,
    '--read-token-id',
    prepareInput.readTokenId,
    '--account-id',
    prepareInput.accountId,
    '--zone-id',
    prepareInput.zoneId,
    '--planned-resource',
    prepareInput.plannedResources[0],
    '--pre-inventory-sha256',
    prepareInput.preInventorySha256,
    '--expected-probe-count',
    String(prepareInput.expectedProbeCount),
  ];

  it('creates a private initial journal and prints only its bounded handoff', async () => {
    const workspaceRoot = resolve(import.meta.dirname, '../../../..');
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
      prepareInput.runId,
      {
        PATH: process.env.PATH ?? '',
        SECRET_THAT_MUST_NOT_ESCAPE: 'never-forward',
      },
      undefined,
      workspaceRoot,
      stateDir,
      prepareInput
    );
    expect(stderr).toBe('');
    expect(stdout).toBe(
      `${JSON.stringify({ runId: prepareInput.runId, nextPhase: 'mutate' })}\n`
    );
    const journalPath = join(stateDir, `${prepareInput.runId}.json`);
    const rawJournal = await readFile(journalPath, 'utf8');
    expect(JSON.parse(rawJournal)).toMatchObject({
      ...prepareInput,
      phase: 'prepared',
      cleanupAttempts: 0,
    });
    expect((await lstat(journalPath)).mode & 0o077).toBe(0);
    expect(`${stdout}${stderr}${rawJournal}`).not.toContain('never-forward');
    await expect(
      spawnIsolatedCloudflareEvidenceProcess(
        spawner,
        'prepare',
        prepareInput.runId,
        { PATH: process.env.PATH ?? '' },
        undefined,
        workspaceRoot,
        stateDir,
        prepareInput
      )
    ).rejects.toThrow('active');
  });
  it('uses separate children with one allowlisted credential and exact command ownership', async () => {
    const spawn = vi.fn(async () => undefined);
    const inherited = { PATH: '/bin', SECRET: 'never-forward' };
    const workspaceRoot = '/workspace';
    const stateDir = '/private/evidence-state';
    await spawnIsolatedCloudflareEvidenceProcess(
      { spawn },
      'prepare',
      prepareInput.runId,
      inherited,
      undefined,
      workspaceRoot,
      stateDir,
      prepareInput
    );
    await spawnIsolatedCloudflareEvidenceProcess(
      { spawn },
      'mutate',
      'run-123',
      inherited,
      { name: 'CLOUDFLARE_WRITE_TOKEN', value: 'write' },
      workspaceRoot,
      stateDir
    );
    await spawnIsolatedCloudflareEvidenceProcess(
      { spawn },
      'cleanup',
      'run-123',
      inherited,
      { name: 'CLOUDFLARE_WRITE_TOKEN', value: 'write' },
      workspaceRoot,
      stateDir
    );
    await spawnIsolatedCloudflareEvidenceProcess(
      { spawn },
      'measure',
      'run-123',
      inherited,
      { name: 'CLOUDFLARE_READ_TOKEN', value: 'read' },
      workspaceRoot,
      stateDir
    );
    expect(spawn).toHaveBeenCalledTimes(4);
    expect(spawn.mock.calls.map(([, argv]) => argv)).toEqual([
      [
        '/workspace/apps/web/tools/cost/qualify-cloudflare-evidence-sources.ts',
        ...prepareArguments,
      ],
      [
        '/workspace/apps/web/tools/cost/mutate-cloudflare-evidence-sources.ts',
        '--run',
        'run-123',
        '--apply',
      ],
      [
        '/workspace/apps/web/tools/cost/mutate-cloudflare-evidence-sources.ts',
        '--cleanup-run',
        'run-123',
      ],
      [
        '/workspace/apps/web/tools/cost/measure-cloudflare-evidence-sources.ts',
        '--run',
        'run-123',
      ],
    ]);
    for (const [executable, , options] of spawn.mock.calls) {
      expect(executable).toBe('/workspace/node_modules/.bin/tsx');
      expect(options.cwd).toBe('/workspace');
      expect(options.env.EVIDENCE_RUN_STATE_DIR).toBe(stateDir);
    }
    for (const [, , { env }] of spawn.mock.calls) {
      expect(env.SECRET).toBeUndefined();
      expect(
        Object.keys(env).filter((key) => key.includes('TOKEN'))
      ).toHaveLength(
        env.CLOUDFLARE_WRITE_TOKEN || env.CLOUDFLARE_READ_TOKEN ? 1 : 0
      );
    }
  });
  it('rejects wrong and inherited credential combinations before spawning', async () => {
    const spawn = vi.fn(async () => undefined);
    await expect(
      spawnIsolatedCloudflareEvidenceProcess(
        { spawn },
        'measure',
        'run',
        {},
        { name: 'CLOUDFLARE_WRITE_TOKEN', value: 'write' },
        '/workspace',
        '/private/evidence-state'
      )
    ).rejects.toThrow('read');
    await expect(
      spawnIsolatedCloudflareEvidenceProcess(
        { spawn },
        'mutate',
        'run',
        { CLOUDFLARE_READ_TOKEN: 'read', CLOUDFLARE_WRITE_TOKEN: 'write' },
        { name: 'CLOUDFLARE_WRITE_TOKEN', value: 'write' },
        '/workspace',
        '/private/evidence-state'
      )
    ).rejects.toThrow('inherited');
  });
});
