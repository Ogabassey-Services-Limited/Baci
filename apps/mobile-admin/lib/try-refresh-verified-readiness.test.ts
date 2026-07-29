import { describe, expect, it, vi } from 'vitest';
import { tryRefreshVerifiedReadiness } from './try-refresh-verified-readiness';

describe('tryRefreshVerifiedReadiness', () => {
  it('reports a completed refresh', async () => {
    await expect(
      tryRefreshVerifiedReadiness(vi.fn().mockResolvedValue(undefined))
    ).resolves.toBe(true);
  });

  it('turns a refresh rejection into a non-blocking stale result', async () => {
    await expect(
      tryRefreshVerifiedReadiness(
        vi.fn().mockRejectedValue(new Error('refresh failed'))
      )
    ).resolves.toBe(false);
  });
});
