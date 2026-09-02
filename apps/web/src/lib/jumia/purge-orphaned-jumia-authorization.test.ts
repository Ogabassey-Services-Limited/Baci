import { describe, expect, it, vi } from 'vitest';
import { purgeOrphanedJumiaAuthorization } from './purge-orphaned-jumia-authorization';

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn() },
}));

describe('purgeOrphanedJumiaAuthorization', () => {
  it('invokes the authenticated purge RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });

    await expect(
      purgeOrphanedJumiaAuthorization(
        { rpc } as never,
        'merchant-1',
        'integration-1'
      )
    ).resolves.toBe(true);

    expect(rpc).toHaveBeenCalledWith('purge_orphaned_jumia_authorization', {
      p_merchant_id: 'merchant-1',
      p_integration_id: 'integration-1',
    });
  });

  it('reports a deferred cleanup when the RPC fails', async () => {
    const rpc = vi.fn().mockResolvedValue({
      error: { message: 'database unavailable' },
    });

    await expect(
      purgeOrphanedJumiaAuthorization(
        { rpc } as never,
        'merchant-1',
        'integration-1'
      )
    ).resolves.toBe(false);
  });
});
