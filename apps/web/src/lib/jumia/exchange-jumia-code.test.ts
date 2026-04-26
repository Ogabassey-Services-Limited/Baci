import { afterEach, describe, expect, it, vi } from 'vitest';
import { exchangeJumiaCode, JumiaApiError } from './helpers';

describe('exchangeJumiaCode refresh token requirement', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects authorization exchanges that cannot be refreshed later', async () => {
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

    await expect(
      exchangeJumiaCode({
        code: 'auth-code',
        clientId: 'client-id',
        clientSecret: 'client-secret',
        redirectUri: 'https://example.com/callback',
      })
    ).rejects.toSatisfy((error: unknown) => {
      return (
        error instanceof JumiaApiError &&
        error.status === 502 &&
        error.message.includes('refresh token')
      );
    });
  });
});
