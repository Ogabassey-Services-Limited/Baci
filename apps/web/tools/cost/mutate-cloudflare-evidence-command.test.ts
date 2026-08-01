import { describe, expect, it, vi } from 'vitest';
import { dispatchMutationCommand } from './mutate-cloudflare-evidence-command';
import {
  mutationCapability,
  mutationResource,
} from './mutate-cloudflare-evidence-test-fixtures';

describe('mutation command dispatch', () => {
  it('dispatches an apply command only after validating mutation dependencies', async () => {
    const apply = vi.fn(async () => ({}) as never);
    const cleanup = vi.fn(async () => ({}) as never);
    const recordRevocation = vi.fn(async () => ({}) as never);
    const client = {
      identity: async () => ({ accountId: 'account', zoneId: 'zone' }),
      findByName: async () => mutationResource,
      get: async () => mutationResource,
      create: async () => ({ id: mutationResource.id }),
      probe: async () => [],
      cleanup: async () => true,
      inventorySha256: async () => 'a'.repeat(64),
    };
    await dispatchMutationCommand(
      ['--run', mutationCapability.runId, '--apply'],
      '/tmp/state',
      { capability: mutationCapability, client },
      { apply, cleanup, recordRevocation }
    );
    expect(apply).toHaveBeenCalledOnce();
    expect(cleanup).not.toHaveBeenCalled();
    expect(recordRevocation).not.toHaveBeenCalled();
  });
});
