import { describe, expect, it } from 'vitest';
import { resolveSnapchatAdsAccessToken } from './access-token';

describe('Snapchat Ads access token', () => {
  it('requires a stored encrypted access token', () => {
    expect(() =>
      resolveSnapchatAdsAccessToken(
        {
          access_token_ciphertext: null,
          refresh_token_ciphertext: null,
          token_expires_at: null,
        },
        {} as never
      )
    ).toThrow('SNAPCHAT_ADS_REAUTH_REQUIRED');
  });
});
