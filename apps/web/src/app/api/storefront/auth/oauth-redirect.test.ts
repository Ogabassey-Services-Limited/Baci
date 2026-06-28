import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveTrustedStorefrontRedirectUrl } from './oauth-redirect';

vi.mock('@/env', () => ({
  getAppUrl: () => 'https://usebaci.com',
  getRootDomain: () => 'usebaci.com',
}));

const merchant = {
  custom_domain: 'ogabassey.com',
  slug: 'ogabassey',
};

describe('resolveTrustedStorefrontRedirectUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to the app account URL when no redirect is supplied', () => {
    expect(resolveTrustedStorefrontRedirectUrl(undefined, merchant)).toBe(
      'https://usebaci.com/account'
    );
  });

  it('normalizes relative redirects against the app origin', () => {
    expect(
      resolveTrustedStorefrontRedirectUrl(
        '/account/callback?tab=orders',
        merchant
      )
    ).toBe('https://usebaci.com/account/callback?tab=orders');
  });

  it('allows the merchant subdomain origin', () => {
    expect(
      resolveTrustedStorefrontRedirectUrl(
        'https://ogabassey.usebaci.com/account/callback',
        merchant
      )
    ).toBe('https://ogabassey.usebaci.com/account/callback');
  });

  it('allows the merchant configured custom-domain origin', () => {
    expect(
      resolveTrustedStorefrontRedirectUrl(
        'https://ogabassey.com/account/callback',
        merchant
      )
    ).toBe('https://ogabassey.com/account/callback');
  });

  it('allows localhost storefront origins outside production', () => {
    expect(
      resolveTrustedStorefrontRedirectUrl(
        'http://ogabassey.localhost:3010/account/callback',
        merchant
      )
    ).toBe('http://ogabassey.localhost:3010/account/callback');

    expect(
      resolveTrustedStorefrontRedirectUrl(
        'http://localhost:3010/ogabassey/account/callback',
        merchant
      )
    ).toBe('http://localhost:3010/ogabassey/account/callback');

    expect(
      resolveTrustedStorefrontRedirectUrl(
        'http://127.0.0.1:3010/account/callback',
        merchant
      )
    ).toBe('http://127.0.0.1:3010/account/callback');
  });

  it('rejects localhost storefront origins in production', () => {
    vi.stubEnv('NODE_ENV', 'production');

    expect(
      resolveTrustedStorefrontRedirectUrl(
        'http://ogabassey.localhost:3010/account/callback',
        merchant
      )
    ).toBeNull();
  });

  it('rejects unrelated absolute origins', () => {
    expect(
      resolveTrustedStorefrontRedirectUrl(
        'https://evil.example/account/callback',
        merchant
      )
    ).toBeNull();
  });

  it('ignores malformed configured custom domains', () => {
    expect(
      resolveTrustedStorefrontRedirectUrl(
        'https://ogabassey.com/account/callback',
        { custom_domain: 'ogabassey.com/path', slug: 'ogabassey' }
      )
    ).toBeNull();
  });
});
