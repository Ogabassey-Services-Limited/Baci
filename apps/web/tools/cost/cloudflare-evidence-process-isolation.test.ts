import { describe, expect, it, vi } from 'vitest';
import { spawnIsolatedCloudflareEvidenceProcess } from './cloudflare-evidence-process-isolation';

describe('spawnIsolatedCloudflareEvidenceProcess', () => {
  it('uses separate children with one allowlisted credential and exact command ownership', async () => {
    const spawn = vi.fn(async () => undefined);
    const inherited = { PATH: '/bin', SECRET: 'never-forward' };
    await spawnIsolatedCloudflareEvidenceProcess(
      { spawn },
      'prepare',
      'run-123',
      inherited
    );
    await spawnIsolatedCloudflareEvidenceProcess(
      { spawn },
      'mutate',
      'run-123',
      inherited,
      { name: 'CLOUDFLARE_WRITE_TOKEN', value: 'write' }
    );
    await spawnIsolatedCloudflareEvidenceProcess(
      { spawn },
      'cleanup',
      'run-123',
      inherited,
      { name: 'CLOUDFLARE_WRITE_TOKEN', value: 'write' }
    );
    await spawnIsolatedCloudflareEvidenceProcess(
      { spawn },
      'measure',
      'run-123',
      inherited,
      { name: 'CLOUDFLARE_READ_TOKEN', value: 'read' }
    );
    expect(spawn).toHaveBeenCalledTimes(4);
    expect(spawn.mock.calls.map(([, argv]) => argv)).toEqual([
      ['qualify-cloudflare-evidence-sources.ts', '--prepare'],
      ['mutate-cloudflare-evidence-sources.ts', '--run', 'run-123', '--apply'],
      ['mutate-cloudflare-evidence-sources.ts', '--cleanup-run', 'run-123'],
      ['measure-cloudflare-evidence-sources.ts', '--run', 'run-123'],
    ]);
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
        { name: 'CLOUDFLARE_WRITE_TOKEN', value: 'write' }
      )
    ).rejects.toThrow('read');
    await expect(
      spawnIsolatedCloudflareEvidenceProcess(
        { spawn },
        'mutate',
        'run',
        { CLOUDFLARE_READ_TOKEN: 'read', CLOUDFLARE_WRITE_TOKEN: 'write' },
        { name: 'CLOUDFLARE_WRITE_TOKEN', value: 'write' }
      )
    ).rejects.toThrow('inherited');
  });
});
