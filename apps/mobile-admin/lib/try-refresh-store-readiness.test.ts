import { describe, expect, it, vi } from 'vitest';
import { tryRefreshStoreReadiness } from './try-refresh-store-readiness';

describe('tryRefreshStoreReadiness', () => {
  it('reports a completed refresh', async () => {
    await expect(
      tryRefreshStoreReadiness(vi.fn().mockResolvedValue(undefined))
    ).resolves.toBe(true);
  });

  it('turns a refresh rejection into a non-blocking stale result', async () => {
    await expect(
      tryRefreshStoreReadiness(
        vi.fn().mockRejectedValue(new Error('refresh failed'))
      )
    ).resolves.toBe(false);
  });
});
