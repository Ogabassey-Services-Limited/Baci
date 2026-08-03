import { describe, expect, it, vi } from 'vitest';
import { fetchGiglWithAccessToken } from './gigl.auth-request';
import type { GiglProviderIo, GiglToken } from './gigl.constants';

const token: GiglToken = {
  token: 'token-1',
  userChannelCode: 'channel',
  customerType: 1,
  expiresAt: Date.now() + 60_000,
};

function response(status: number): Response {
  return new Response(null, { status });
}

describe('fetchGiglWithAccessToken', () => {
  it('refreshes the token after an HTTP authentication rejection', async () => {
    const safeFetch = vi
      .fn()
      .mockResolvedValueOnce(response(401))
      .mockResolvedValueOnce(response(200));
    const io: GiglProviderIo = { safeFetch, log: vi.fn() };
    const getApiToken = vi
      .fn()
      .mockResolvedValue({ ...token, token: 'token-2' });
    const invalidateCachedToken = vi.fn();

    const result = await fetchGiglWithAccessToken(
      io,
      getApiToken,
      invalidateCachedToken,
      'https://gigl.test/track',
      token,
      () => ({ method: 'GET', timeout: 5000 })
    );

    expect(result.response.status).toBe(200);
    expect(getApiToken).toHaveBeenCalledWith(5000, undefined);
    expect(invalidateCachedToken).toHaveBeenCalledWith('token-1');
    expect(
      new Headers(safeFetch.mock.calls[1]?.[1]?.headers).get('access-token')
    ).toBe('token-2');
  });
});
