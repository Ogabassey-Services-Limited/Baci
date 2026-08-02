import { chmod, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  loadEvidenceRunForCleanup,
  openEvidenceRun,
} from './cloudflare-evidence-run-journal';
import {
  reconcileCreatedEvidenceResource,
  requireTokenReadBackClient,
  requireTokenRevocationClient,
  revokeCleanupWriteTokenIfNeeded,
  revokeWriteTokenIfAvailable,
  verifyInventoryBeforeCleanup,
  verifyInventoryBeforeMutation,
} from './mutate-cloudflare-evidence-cleanup-support';
import type {
  EvidenceMutationClient,
  EvidenceResource,
} from './mutate-cloudflare-evidence-support';
import {
  mutationInput,
  mutationResource,
} from './mutate-cloudflare-evidence-test-fixtures';

const inventoryHash = 'a'.repeat(64);

async function createRun() {
  const dir = await mkdtemp(join(tmpdir(), 'baci-evidence-'));
  await chmod(dir, 0o700);
  await openEvidenceRun(dir, mutationInput);
  return dir;
}

function createClient(
  overrides: Partial<EvidenceMutationClient> = {}
): EvidenceMutationClient {
  return {
    identity: async () => ({ accountId: 'account', zoneId: 'zone' }),
    findByName: async () => null,
    get: async () => mutationResource,
    create: async () => ({ id: mutationResource.id }),
    probe: async () => [],
    cleanup: async () => true,
    inventorySha256: async () => inventoryHash,
    ...overrides,
  };
}

describe('mutation cleanup support', () => {
  it('uses the resource-aware inventory query before mutation', async () => {
    const dir = await createRun();
    const inventorySha256 = vi.fn(async (resource?: EvidenceResource) => {
      expect(resource).toBe(mutationResource);
      return inventoryHash;
    });

    await verifyInventoryBeforeMutation(
      createClient({ inventorySha256 }),
      await loadEvidenceRunForCleanup(dir, mutationInput.runId),
      mutationResource
    );
    expect(inventorySha256).toHaveBeenCalledWith(mutationResource);
  });

  it('uses the full inventory query when no resource exists before mutation', async () => {
    const dir = await createRun();
    const inventorySha256 = vi.fn(async (...args: unknown[]) => {
      expect(args).toHaveLength(0);
      return inventoryHash;
    });

    await verifyInventoryBeforeMutation(
      createClient({ inventorySha256 }),
      await loadEvidenceRunForCleanup(dir, mutationInput.runId),
      null
    );
    expect(inventorySha256).toHaveBeenCalledWith();
  });

  it('rejects inventory drift before mutation and cleanup', async () => {
    const dir = await createRun();
    const journal = await loadEvidenceRunForCleanup(dir, mutationInput.runId);
    await expect(
      verifyInventoryBeforeMutation(
        createClient({ inventorySha256: async () => 'c'.repeat(64) }),
        journal,
        null
      )
    ).rejects.toThrow('before mutation');
    await expect(
      verifyInventoryBeforeCleanup(
        createClient({ inventorySha256: async () => 'c'.repeat(64) }),
        journal,
        new Map([[mutationResource.name, mutationResource.id]])
      )
    ).rejects.toThrow('before cleanup');
  });

  it('does not delete a create response until the exact resource is bound to the run', async () => {
    const dir = await createRun();
    const journal = await loadEvidenceRunForCleanup(dir, mutationInput.runId);
    const cleanup = vi.fn(async () => true);
    await expect(
      reconcileCreatedEvidenceResource(
        createClient({
          get: async () => ({
            ...mutationResource,
            accountId: 'other-account',
          }),
          cleanup,
        }),
        journal,
        mutationResource.name,
        mutationResource.id
      )
    ).rejects.toThrow('journaled resource identity');
    expect(cleanup).not.toHaveBeenCalled();
  });

  it('binds a same-name concurrent resource before cleanup', async () => {
    const dir = await createRun();
    const journal = await loadEvidenceRunForCleanup(dir, mutationInput.runId);
    const cleanup = vi.fn(async () => true);
    let cleaned = false;
    await expect(
      reconcileCreatedEvidenceResource(
        createClient({
          findByName: async () => ({ ...mutationResource, id: 'concurrent' }),
          get: async (id) =>
            id === 'concurrent' && !cleaned
              ? { ...mutationResource, id }
              : null,
          cleanup: async (...args) => {
            cleaned = true;
            return cleanup(...args);
          },
        }),
        journal,
        mutationResource.name
      )
    ).resolves.toBeUndefined();
    expect(cleanup).toHaveBeenCalledWith(mutationResource.name, 'concurrent');
  });

  it('selects the bounded cleanup inventory strategy for zero, one, and many resources', async () => {
    const zeroDir = await createRun();
    const zeroInventory = vi.fn(async (...args: unknown[]) => {
      expect(args).toHaveLength(0);
      return inventoryHash;
    });
    await verifyInventoryBeforeCleanup(
      createClient({ inventorySha256: zeroInventory }),
      await loadEvidenceRunForCleanup(zeroDir, mutationInput.runId),
      new Map()
    );
    expect(zeroInventory).toHaveBeenCalledWith();

    const oneDir = await createRun();
    const oneInventory = vi.fn(async (resource?: EvidenceResource) => {
      expect(resource).toBe(mutationResource);
      return inventoryHash;
    });
    await verifyInventoryBeforeCleanup(
      createClient({ inventorySha256: oneInventory }),
      await loadEvidenceRunForCleanup(oneDir, mutationInput.runId),
      new Map([[mutationResource.name, mutationResource.id]])
    );
    expect(oneInventory).toHaveBeenCalledWith(mutationResource);

    const manyDir = await createRun();
    const secondResource = {
      ...mutationResource,
      id: 'resource-2',
      name: 'second',
    };
    const inventorySha256Excluding = vi.fn(
      async (resources: readonly EvidenceResource[]) => {
        expect(resources).toEqual([mutationResource, secondResource]);
        return inventoryHash;
      }
    );
    await verifyInventoryBeforeCleanup(
      createClient({
        get: async (id) =>
          id === mutationResource.id ? mutationResource : secondResource,
        inventorySha256Excluding,
      }),
      await loadEvidenceRunForCleanup(manyDir, mutationInput.runId),
      new Map([
        [mutationResource.name, mutationResource.id],
        [secondResource.name, secondResource.id],
      ])
    );
    expect(inventorySha256Excluding).toHaveBeenCalledTimes(1);
  });

  it('requires provider exclusion support for multi-resource cleanup', async () => {
    const dir = await createRun();
    await expect(
      verifyInventoryBeforeCleanup(
        createClient({
          get: async (id) =>
            id === mutationResource.id
              ? mutationResource
              : {
                  ...mutationResource,
                  id: 'resource-2',
                  name: 'second',
                },
        }),
        await loadEvidenceRunForCleanup(dir, mutationInput.runId),
        new Map([
          [mutationResource.name, mutationResource.id],
          ['second', 'resource-2'],
        ])
      )
    ).rejects.toThrow('multi-resource cleanup');
  });

  it('validates token client capabilities and skips absent token revocation', async () => {
    const revoke = vi.fn();
    const readBack = vi.fn();
    expect(requireTokenRevocationClient({ revoke, readBack })).toEqual({
      revoke,
      readBack,
    });
    expect(requireTokenReadBackClient({ readBack })).toEqual({ readBack });
    expect(() => requireTokenRevocationClient(createClient())).toThrow(
      'revocation readback'
    );
    expect(() => requireTokenReadBackClient(createClient())).toThrow(
      'revocation readback'
    );

    await expect(
      revokeCleanupWriteTokenIfNeeded(
        'unused',
        mutationInput.runId,
        undefined,
        createClient()
      )
    ).resolves.toBeUndefined();
    await expect(
      revokeWriteTokenIfAvailable('unused', mutationInput.runId, createClient())
    ).resolves.toBe(false);
  });
});
