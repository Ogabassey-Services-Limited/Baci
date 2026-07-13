import { resolveStorefrontApiBaseUrl } from './storefront-api-url';

describe('resolveStorefrontApiBaseUrl', () => {
  it('falls back to the Ogabassey storefront domain when config is missing', () => {
    expect(resolveStorefrontApiBaseUrl()).toBe('https://ogabassey.com');
    expect(resolveStorefrontApiBaseUrl(null)).toBe('https://ogabassey.com');
    expect(resolveStorefrontApiBaseUrl('')).toBe('https://ogabassey.com');
  });

  it('does not use the platform root domain for storefront-scoped endpoints', () => {
    expect(resolveStorefrontApiBaseUrl('https://usebaci.com')).toBe(
      'https://ogabassey.com'
    );
    expect(resolveStorefrontApiBaseUrl('https://www.usebaci.com')).toBe(
      'https://ogabassey.com'
    );
    expect(resolveStorefrontApiBaseUrl('https://UseBaci.com')).toBe(
      'https://ogabassey.com'
    );
  });

  it('preserves storefront subdomains and custom domains', () => {
    expect(resolveStorefrontApiBaseUrl('http://ogabassey.com')).toBe(
      'http://ogabassey.com'
    );
    expect(resolveStorefrontApiBaseUrl('https://ogabassey.usebaci.com')).toBe(
      'https://ogabassey.usebaci.com'
    );
    expect(resolveStorefrontApiBaseUrl('https://ogabassey.com')).toBe(
      'https://ogabassey.com'
    );
    expect(resolveStorefrontApiBaseUrl('https://ogabassey.com:8080')).toBe(
      'https://ogabassey.com:8080'
    );
  });

  it('strips paths, query strings, hashes, and trailing slashes', () => {
    expect(resolveStorefrontApiBaseUrl('  https://ogabassey.com/  ')).toBe(
      'https://ogabassey.com'
    );
    expect(
      resolveStorefrontApiBaseUrl('https://ogabassey.com/storefront?x=1#top')
    ).toBe('https://ogabassey.com');
  });

  it('uses the default storefront domain when config and fallback are invalid', () => {
    expect(resolveStorefrontApiBaseUrl('not-a-url', 'also-not-a-url')).toBe(
      'https://ogabassey.com'
    );
  });

  it('uses a valid fallback when the primary config is blank', () => {
    expect(
      resolveStorefrontApiBaseUrl('   ', 'https://ogabassey.usebaci.com/api')
    ).toBe('https://ogabassey.usebaci.com');
  });

  it('prefers a valid storefront config over the fallback', () => {
    expect(
      resolveStorefrontApiBaseUrl(
        'https://ogabassey.usebaci.com',
        'https://ogabassey.com'
      )
    ).toBe('https://ogabassey.usebaci.com');
    expect(
      resolveStorefrontApiBaseUrl(
        'https://ogabassey.com',
        'https://usebaci.com'
      )
    ).toBe('https://ogabassey.com');
  });
});
