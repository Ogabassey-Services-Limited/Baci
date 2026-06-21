import { describe, expect, it } from 'vitest';
import { getBlogStorefrontPathPrefix } from './blog-storefront-path-prefix';

const merchant = { slug: 'ogabassey', custom_domain: 'ogabassey.com' };

function headersFrom(entries: Record<string, string>): Headers {
  return new Headers(entries);
}

describe('getBlogStorefrontPathPrefix', () => {
  it('uses root-relative paths on the merchant subdomain (trusted x-merchant-slug)', () => {
    expect(
      getBlogStorefrontPathPrefix(
        headersFrom({ 'x-merchant-slug': 'ogabassey' }),
        merchant
      )
    ).toBe('');
  });

  it('uses root-relative paths on the merchant custom domain (case-insensitive)', () => {
    expect(
      getBlogStorefrontPathPrefix(
        headersFrom({ 'x-custom-domain': 'OGABASSEY.com' }),
        merchant
      )
    ).toBe('');
  });

  it('falls back to the /slug prefix for path-based access with no merchant headers', () => {
    expect(getBlogStorefrontPathPrefix(headersFrom({}), merchant)).toBe(
      '/ogabassey'
    );
  });

  it('ignores forged headers that do not match the resolved merchant', () => {
    // A spoofed x-merchant-slug / x-custom-domain for a different merchant must
    // not drop the /slug prefix on a path-based request (CodeRabbit finding).
    expect(
      getBlogStorefrontPathPrefix(
        headersFrom({
          'x-merchant-slug': 'attacker',
          'x-custom-domain': 'evil.example',
        }),
        merchant
      )
    ).toBe('/ogabassey');
  });

  it('treats an empty custom-domain header as untrusted', () => {
    expect(
      getBlogStorefrontPathPrefix(
        headersFrom({ 'x-custom-domain': '' }),
        merchant
      )
    ).toBe('/ogabassey');
  });

  it('does not match a custom-domain header when the merchant has none', () => {
    expect(
      getBlogStorefrontPathPrefix(
        headersFrom({ 'x-custom-domain': 'evil.example' }),
        {
          slug: 'ogabassey',
          custom_domain: null,
        }
      )
    ).toBe('/ogabassey');
  });
});
