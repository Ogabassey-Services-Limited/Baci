import { describe, expect, it, vi } from 'vitest';
import { purgeOrphanedJumiaAuthorization } from './purge-orphaned-jumia-authorization';

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn() },
}));

describe('purgeOrphanedJumiaAuthorization', () => {
  it('invokes the authenticated purge RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });

    await purgeOrphanedJumiaAuthorization(
      { rpc } as never,
      'merchant-1',
      'integration-1'
    );

    expect(rpc).toHaveBeenCalledWith('purge_orphaned_jumia_authorization', {
      p_merchant_id: 'merchant-1',
      p_integration_id: 'integration-1',
    });
  });
});
