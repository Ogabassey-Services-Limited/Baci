import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ checkRateLimit: vi.fn() }));

vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: mocks.checkRateLimit,
}));

import { getVerificationRateLimitError } from './verification-rate-limit';

describe('getVerificationRateLimitError', () => {
  it('returns a rate-limit response with the requested quota parameters', async () => {
    mocks.checkRateLimit.mockResolvedValue(false);

    const response = await getVerificationRateLimitError(
      {} as never,
      'user-1',
      'verify-nin-preflight',
      30
    );

    expect(mocks.checkRateLimit).toHaveBeenCalledWith(
      {},
      'user-1',
      'verify-nin-preflight',
      30,
      1
    );
    expect(response?.status).toBe(429);
    expect(response?.headers.get('Cache-Control')).toBe('no-store');
    await expect(response?.json()).resolves.toEqual({
      error: 'Rate limit exceeded',
      code: 'rate_limited',
    });
  });

  it('returns null when the quota allows the request', async () => {
    mocks.checkRateLimit.mockResolvedValue(true);

    await expect(
      getVerificationRateLimitError({} as never, 'user-1', 'verify-nin', 3)
    ).resolves.toBeNull();
  });

  it('fails closed when the rate-limit backend is unavailable', async () => {
    mocks.checkRateLimit.mockRejectedValue(
      new Error('rate limiter unavailable')
    );

    const response = await getVerificationRateLimitError(
      {} as never,
      'user-1',
      'verify-nin',
      3
    );

    expect(response?.status).toBe(503);
    expect(response?.headers.get('Cache-Control')).toBe('no-store');
    await expect(response?.json()).resolves.toEqual({
      error: 'Verification is temporarily unavailable',
      code: 'verification_rate_limit_unavailable',
    });
  });
});
