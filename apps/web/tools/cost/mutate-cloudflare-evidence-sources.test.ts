import { chmod, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { openEvidenceRun } from './cloudflare-evidence-run-journal';
import {
  applyCloudflareEvidenceMutation,
  cleanupCloudflareEvidenceRun,
  parseMutationArguments,
} from './mutate-cloudflare-evidence-sources';

describe('parseMutationArguments', () => {
  it('requires an explicit apply run and refuses measurement modes', () => {
    expect(parseMutationArguments(['--run', 'run-123', '--apply']).mode).toBe(
      'apply'
    );
    expect(() =>
      parseMutationArguments(['--run', 'run-123', '--measure'])
    ).toThrow('apply');
  });
});

const input = {
  runId: 'run-123',
  approvalId: 'approval',
  policyId: 'policy',
  writeTokenId: 'write',
  readTokenId: 'read',
  accountId: 'account',
  zoneId: 'zone',
  plannedResources: ['baci-evidence-run-123'],
  preInventorySha256: 'a'.repeat(64),
  expectedProbeCount: 2,
};
const capability = {
  ...input,
  tokenId: 'write',
  permissionGroupIds: ['workers.write'],
  resources: ['account'],
  expiresAt: '2026-08-01T00:00:00.000Z',
  policySha256: 'b'.repeat(64),
  kind: 'write' as const,
  providerNegativeScopeUnverified: true as const,
};
const resource = {
  id: 'resource-1',
  name: 'baci-evidence-run-123',
  description: 'baci evidence run-123',
  accountId: 'account',
  zoneId: 'zone',
};

describe('Cloudflare evidence mutation lifecycle', () => {
  it('recovers a partial-create crash from the exact journaled resource without creating again', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'baci-evidence-'));
    await chmod(dir, 0o700);
    await openEvidenceRun(dir, input);
    const create = vi.fn();
    const client = {
      identity: async () => ({ accountId: 'account', zoneId: 'zone' }),
      findByName: async () => resource,
      get: async () => resource,
      create,
      probe: async () => true,
      cleanup: async () => true,
      inventorySha256: async () => 'a'.repeat(64),
    };
    await expect(
      applyCloudflareEvidenceMutation(dir, input.runId, capability, client)
    ).resolves.toMatchObject({ phase: 'cleanup_verified' });
    expect(create).not.toHaveBeenCalled();
  });
  it('rejects collisions and cleanup refuses wrong identity without creating or probing', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'baci-evidence-'));
    await chmod(dir, 0o700);
    await openEvidenceRun(dir, input);
    const create = vi.fn();
    await expect(
      applyCloudflareEvidenceMutation(dir, input.runId, capability, {
        identity: async () => ({ accountId: 'account', zoneId: 'zone' }),
        findByName: async () => ({ ...resource, description: 'collision' }),
        get: async () => resource,
        create,
        probe: async () => true,
        cleanup: async () => true,
        inventorySha256: async () => 'a'.repeat(64),
      })
    ).rejects.toThrow('collision');
    expect(create).not.toHaveBeenCalled();
    await expect(
      cleanupCloudflareEvidenceRun(dir, input.runId, capability, {
        identity: async () => ({ accountId: 'wrong', zoneId: 'zone' }),
        get: async () => resource,
        cleanup: async () => true,
        inventorySha256: async () => 'a'.repeat(64),
      })
    ).rejects.toThrow('account');
  });
});
