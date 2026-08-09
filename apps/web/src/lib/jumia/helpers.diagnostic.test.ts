import { describe, expect, it, vi } from 'vitest';

vi.mock('@/env', () => ({
  env: { JUMIA_ENVIRONMENT: 'production' },
}));

import { getJumiaAuthUrl, isJumiaAuthUrlVariant } from '@/lib/jumia/helpers';

describe('Jumia OAuth documented-baseline diagnostic variant', () => {
  it('uses exactly the authorization parameters documented by Jumia', () => {
    const url = new URL(
      getJumiaAuthUrl({
        clientId: 'client-id',
        redirectUri: 'https://usebaci.com/api/marketplace/jumia/callback',
        state: 'state',
        variant: 'F',
      })
    );

    expect(url.searchParams.get('scope')).toBe('openid');
    expect(url.searchParams.get('prompt')).toBe('login');
    expect(url.searchParams.has('max_age')).toBe(false);
    expect(isJumiaAuthUrlVariant('F')).toBe(true);
  });
});
