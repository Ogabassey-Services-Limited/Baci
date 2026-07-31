import { describe, expect, it, vi } from 'vitest';
import { checkRateLimit } from './rate-limiter';

describe('checkRateLimit', () => {
  it('fails closed when a verification quota check cannot reach the database', async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: new Error('database unavailable'),
      }),
    };

    await expect(
      checkRateLimit(supabase as never, 'user-1', 'verify-nin', 3, 1)
    ).resolves.toBe(false);
  });

  it('preserves fail-open handling for non-verification quota checks', async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: new Error('database unavailable'),
      }),
    };

    await expect(
      checkRateLimit(supabase as never, 'user-1', 'newsletter', 3, 1)
    ).resolves.toBe(true);
  });
});
