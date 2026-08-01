import { describe, expect, it, vi } from 'vitest';
import { spawnIsolatedCloudflareEvidenceProcess } from './cloudflare-evidence-process-isolation';

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
});
