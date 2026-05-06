import { afterEach, describe, expect, it, vi } from 'vitest';
import { exchangeJumiaCode } from './helpers';

describe('exchangeJumiaCode refresh token handling', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the parsed response when Jumia omits refresh_token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: 'short-lived-access-token',
            expires_in: 3600,
            token_type: 'Bearer',
          }),
      })
    );

    const result = await exchangeJumiaCode({
      code: 'auth-code',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      redirectUri: 'https://example.com/callback',
    });

    expect(result).toEqual({
      access_token: 'short-lived-access-token',
      expires_in: 3600,
      token_type: 'Bearer',
    });
    expect(result.refresh_token).toBeUndefined();
  });
});
