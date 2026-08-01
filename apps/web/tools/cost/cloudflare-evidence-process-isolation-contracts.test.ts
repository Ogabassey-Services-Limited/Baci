import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it, vi } from 'vitest';
import { spawnIsolatedCloudflareEvidenceProcess } from './cloudflare-evidence-process-isolation';
import { openEvidenceRun } from './cloudflare-evidence-run-journal';

const execFileAsync = promisify(execFile);

describe('spawnIsolatedCloudflareEvidenceProcess credential boundaries', () => {
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

  it('rejects a changed transitive command import before spawning a credential', async () => {
    const root = await realpath(
      await mkdtemp(join(tmpdir(), 'baci-command-integrity-'))
    );
    const toolsDir = join(root, 'apps/web/tools/cost');
    const commandPath = join(toolsDir, 'mutate-cloudflare-evidence-sources.ts');
    const dependencyPath = join(toolsDir, 'command-helper.ts');
    const runnerPath = join(toolsDir, 'runner.ts');
    const stateDir = await mkdtemp(join(tmpdir(), 'baci-command-state-'));
    await chmod(stateDir, 0o700);
    await mkdir(toolsDir, { recursive: true });
    await writeFile(
      commandPath,
      "import { value } from './command-helper';\nexport { value };\n"
    );
    await writeFile(dependencyPath, 'export const value = 1;\n');
    await writeFile(runnerPath, 'export const runner = 1;\n');
    await execFileAsync('git', ['-C', root, 'init', '--quiet']);
    await execFileAsync('git', ['-C', root, 'add', '--', '.']);
    await execFileAsync('git', [
      '-C',
      root,
      '-c',
      'user.email=baci-test@example.invalid',
      '-c',
      'user.name=Baci Test Fixture',
      'commit',
      '--quiet',
      '-m',
      'fixture',
    ]);
    const { stdout: head } = await execFileAsync('git', [
      '-C',
      root,
      'rev-parse',
      '--verify',
      'HEAD',
    ]);
    const runnerModuleSha256 = createHash('sha256')
      .update(await readFile(runnerPath))
      .digest('hex');
    const runId = 'a'.repeat(32);
    const input = {
      runId,
      approvalId: 'approval',
      policyId: 'policy',
      toolingMergeSha: head.trim(),
      writeTokenId: 'write-token',
      readTokenId: 'read-token',
      readPolicySha256: 'b'.repeat(64),
      accountId: 'account',
      zoneId: 'zone',
      plannedResources: ['resource'],
      preInventorySha256: 'c'.repeat(64),
      expectedProbeCount: 2,
      mutationRunnerModulePath: runnerPath,
      mutationRunnerModuleSha256: runnerModuleSha256,
      measurementRunnerModulePath: runnerPath,
      measurementRunnerModuleSha256: runnerModuleSha256,
    } as const;
    const spawn = vi.fn(async () => undefined);
    try {
      await openEvidenceRun(stateDir, input);
      await spawnIsolatedCloudflareEvidenceProcess(
        { spawn },
        'mutate',
        runId,
        {},
        { name: 'CLOUDFLARE_WRITE_TOKEN', value: 'write' },
        root,
        stateDir
      );
      expect(spawn).toHaveBeenCalledTimes(1);
      await writeFile(dependencyPath, 'export const value = 2;\n');
      await expect(
        spawnIsolatedCloudflareEvidenceProcess(
          { spawn },
          'mutate',
          runId,
          {},
          { name: 'CLOUDFLARE_WRITE_TOKEN', value: 'write' },
          root,
          stateDir
        )
      ).rejects.toThrow('differs from the reviewed commit');
      expect(spawn).toHaveBeenCalledTimes(1);
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(stateDir, { recursive: true, force: true });
    }
  });
});
