import { chmod, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { openEvidenceRun } from './cloudflare-evidence-run-journal';
import { applyCloudflareEvidenceMutation } from './mutate-cloudflare-evidence-sources';
import {
  mutationCapability,
  mutationInput,
  mutationResource,
  reviewedProbeResults,
} from './mutate-cloudflare-evidence-test-fixtures';

describe('Cloudflare evidence mutation guards', () => {
  it('blocks inventory drift before create and requires exactly the journaled probe count', async () => {
    const cases = [
      {
        inventorySha256: async () => 'b'.repeat(64),
        probe: async () => reviewedProbeResults(),
        error: 'before mutation',
      },
      {
        inventorySha256: async () => 'a'.repeat(64),
        probe: async () => reviewedProbeResults().slice(0, 1),
        error: 'matrix',
      },
      {
        inventorySha256: async () => 'a'.repeat(64),
        probe: async () => [
          ...reviewedProbeResults(),
          { ...reviewedProbeResults()[0], id: 'probe-2' },
        ],
        error: 'matrix',
      },
    ];
    for (const entry of cases) {
      const dir = await mkdtemp(join(tmpdir(), 'baci-evidence-'));
      await chmod(dir, 0o700);
      await openEvidenceRun(dir, mutationInput);
      const create = vi.fn(async () => ({ id: mutationResource.id }));
      let resourcePresent = true;
      const cleanup = vi.fn(async () => {
        resourcePresent = false;
        return true;
      });
      await expect(
        applyCloudflareEvidenceMutation(
          dir,
          mutationInput.runId,
          mutationCapability,
          {
            identity: async () => ({ accountId: 'account', zoneId: 'zone' }),
            findByName: async () => null,
            get: async () => (resourcePresent ? mutationResource : null),
            create,
            probe: entry.probe,
            cleanup,
            inventorySha256: entry.inventorySha256,
          }
        )
      ).rejects.toThrow(entry.error);
      if (entry.error === 'before mutation')
        expect(create).not.toHaveBeenCalled();
      else expect(cleanup).toHaveBeenCalledOnce();
    }
  });
});
