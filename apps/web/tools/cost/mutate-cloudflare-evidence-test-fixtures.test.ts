import { describe, expect, it } from 'vitest';
import type { ReplacementCapability } from './mutate-cloudflare-evidence-test-fixtures';
import {
  cleanupReceipt,
  mutationCapability,
  mutationInput,
  mutationResource,
} from './mutate-cloudflare-evidence-test-fixtures';

describe('mutation evidence test fixtures', () => {
  it('binds the capability and resource fixtures to one deterministic run', () => {
    expect(mutationInput.runId).toMatch(/^[a-f0-9]{32}$/);
    expect(mutationInput.plannedResources).toEqual([
      `baci-evidence-${mutationInput.runId}`,
    ]);
    expect(mutationInput.expectedProbeCount).toBe(2);
    expect(mutationCapability).toMatchObject({
      runId: mutationInput.runId,
      writeTokenId: mutationInput.writeTokenId,
      tokenId: mutationInput.writeTokenId,
      kind: 'write',
      permissionGroupIds: ['workers.write'],
    });
    expect(mutationResource).toMatchObject({
      id: 'resource-1',
      name: mutationInput.plannedResources[0],
      description: `baci evidence ${mutationInput.runId}`,
      accountId: mutationInput.accountId,
      zoneId: mutationInput.zoneId,
    });
  });

  it('provides cleanup readback evidence matching the pre-mutation inventory', async () => {
    const receipt = await cleanupReceipt.verifyCleanup();
    expect(receipt).toEqual({
      status: 'absent',
      inventorySha256: mutationInput.preInventorySha256,
      providerReceiptSha256: 'e'.repeat(64),
      observedAt: '2026-07-31T00:00:00.000Z',
    });
  });

  it('supports a cleanup-only replacement capability without changing the run authority', () => {
    const replacement: ReplacementCapability = {
      ...mutationCapability,
      tokenId: 'replacement-write',
      policySha256: mutationInput.cleanupPolicySha256,
      replacementForTokenId: mutationInput.writeTokenId,
      cleanupOnly: true,
    };
    expect(replacement).toMatchObject({
      runId: mutationInput.runId,
      accountId: mutationInput.accountId,
      zoneId: mutationInput.zoneId,
      replacementForTokenId: mutationInput.writeTokenId,
      cleanupOnly: true,
    });
  });
});
