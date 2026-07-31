import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it, vi } from 'vitest';
import { spawnIsolatedCloudflareEvidenceProcess } from './cloudflare-evidence-process-isolation';

describe('spawnIsolatedCloudflareEvidenceProcess', () => {
  it('runs the pinned local tsx runner with an absolute harmless prepare module', async () => {
    const workspaceRoot = resolve(import.meta.dirname, '../../../..');
    const result = await promisify(execFile)(
      resolve(workspaceRoot, 'node_modules/.bin/tsx'),
      [
        resolve(
          workspaceRoot,
          'apps/web/tools/cost/qualify-cloudflare-evidence-sources.ts'
        ),
        '--prepare',
      ],
      { cwd: workspaceRoot, env: { PATH: process.env.PATH ?? '' } }
    );
    expect(result.stderr).toBe('');
  });
  it('uses separate children with one allowlisted credential and exact command ownership', async () => {
    const spawn = vi.fn(async () => undefined);
    const inherited = { PATH: '/bin', SECRET: 'never-forward' };
    const workspaceRoot = '/workspace';
    await spawnIsolatedCloudflareEvidenceProcess(
      { spawn },
      'prepare',
      'run-123',
      inherited,
      undefined,
      workspaceRoot
    );
    await spawnIsolatedCloudflareEvidenceProcess(
      { spawn },
      'mutate',
      'run-123',
      inherited,
      { name: 'CLOUDFLARE_WRITE_TOKEN', value: 'write' },
      workspaceRoot
    );
    await spawnIsolatedCloudflareEvidenceProcess(
      { spawn },
      'cleanup',
      'run-123',
      inherited,
      { name: 'CLOUDFLARE_WRITE_TOKEN', value: 'write' },
      workspaceRoot
    );
    await spawnIsolatedCloudflareEvidenceProcess(
      { spawn },
      'measure',
      'run-123',
      inherited,
      { name: 'CLOUDFLARE_READ_TOKEN', value: 'read' },
      workspaceRoot
    );
    expect(spawn).toHaveBeenCalledTimes(4);
    expect(spawn.mock.calls.map(([, argv]) => argv)).toEqual([
      [
        '/workspace/apps/web/tools/cost/qualify-cloudflare-evidence-sources.ts',
        '--prepare',
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
        '/workspace'
      )
    ).rejects.toThrow('read');
    await expect(
      spawnIsolatedCloudflareEvidenceProcess(
        { spawn },
        'mutate',
        'run',
        { CLOUDFLARE_READ_TOKEN: 'read', CLOUDFLARE_WRITE_TOKEN: 'write' },
        { name: 'CLOUDFLARE_WRITE_TOKEN', value: 'write' },
        '/workspace'
      )
    ).rejects.toThrow('inherited');
  });
});
