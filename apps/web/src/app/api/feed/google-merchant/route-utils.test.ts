import { describe, expect, it } from 'vitest';
import { buildMerchantBaseUrl } from './route-utils';

describe('buildMerchantBaseUrl', () => {
  it('uses custom_domain when present', () => {
    const result = buildMerchantBaseUrl({
      slug: 'ogabassey',
      custom_domain: 'ogabassey.com',
    });
    expect(result).toBe('https://ogabassey.com');
  });

  it('falls back to slug.baci.app when no custom_domain', () => {
    const result = buildMerchantBaseUrl({
      slug: 'ogabassey',
      custom_domain: null,
    });
    expect(result).toBe('https://ogabassey.baci.app');
  });

  it('falls back to slug.baci.app when custom_domain is empty string', () => {
    const result = buildMerchantBaseUrl({
      slug: 'ogabassey',
      custom_domain: '',
    });
    expect(result).toBe('https://ogabassey.baci.app');
  });

  it('falls back to slug.baci.app when custom_domain is undefined', () => {
    const result = buildMerchantBaseUrl({
      slug: 'ogabassey',
    });
    expect(result).toBe('https://ogabassey.baci.app');
  });

  it('does not include trailing slash', () => {
    const result = buildMerchantBaseUrl({
      slug: 'teststore',
      custom_domain: 'shop.example.com',
    });
    expect(result).not.toMatch(/\/$/);

    const fallbackResult = buildMerchantBaseUrl({
      slug: 'teststore',
    });
    expect(fallbackResult).not.toMatch(/\/$/);
  });

  it('normalizes protocol and slashes from custom_domain', () => {
    const result = buildMerchantBaseUrl({
      slug: 'ogabassey',
      custom_domain: 'https://shop.example.com/',
    });
    expect(result).toBe('https://shop.example.com');
  });

  it('falls back to slug when custom_domain contains path segments', () => {
    const result = buildMerchantBaseUrl({
      slug: 'ogabassey',
      custom_domain: 'example.com/../../malicious',
    });
    expect(result).toBe('https://ogabassey.baci.app');
  });

  it('falls back to slug when custom_domain contains a port', () => {
    const result = buildMerchantBaseUrl({
      slug: 'ogabassey',
      custom_domain: 'example.com:8080',
    });
    expect(result).toBe('https://ogabassey.baci.app');
  });

  it('throws when slug is blank and no custom_domain is available', () => {
    expect(() =>
      buildMerchantBaseUrl({
        slug: '   ',
      })
    ).toThrow('Merchant slug is required to build storefront URL');
  });

  it('throws when slug is empty and no custom_domain is available', () => {
    expect(() =>
      buildMerchantBaseUrl({
        slug: '',
      })
    ).toThrow('Merchant slug is required to build storefront URL');
  });
});
