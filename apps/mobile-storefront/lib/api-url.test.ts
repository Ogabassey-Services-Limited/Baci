import { resolveApiBaseUrl } from './api-url';

describe('resolveApiBaseUrl', () => {
  it('falls back to the canonical root domain when config is missing', () => {
    expect(resolveApiBaseUrl()).toBe('https://usebaci.com');
    expect(resolveApiBaseUrl('')).toBe('https://usebaci.com');
  });

  it('normalizes merchant usebaci subdomains to the canonical root domain', () => {
    expect(resolveApiBaseUrl('https://ogabassey.usebaci.com')).toBe(
      'https://usebaci.com'
    );
    expect(resolveApiBaseUrl('https://ogabassey.usebaci.com/')).toBe(
      'https://usebaci.com'
    );
  });

  it('preserves custom domains while stripping trailing slashes and paths', () => {
    expect(resolveApiBaseUrl('https://ogabassey.com/')).toBe(
      'https://ogabassey.com'
    );
    expect(resolveApiBaseUrl('https://ogabassey.com/storefront')).toBe(
      'https://ogabassey.com'
    );
  });

  it('returns the canonical root domain when the configured URL is invalid', () => {
    expect(resolveApiBaseUrl('not-a-url')).toBe('https://usebaci.com');
  });
});
