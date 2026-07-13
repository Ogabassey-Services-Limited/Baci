import { describe, expect, it } from 'vitest';
import { buildStorefrontPublicationPurgeHostnames } from './storefront-publication-purge-hostnames';

describe('buildStorefrontPublicationPurgeHostnames', () => {
  it('builds every Cloudflare-cached hostname for a configured merchant', () => {
    expect(buildStorefrontPublicationPurgeHostnames(['ogabassey'])).toEqual([
      'ogabassey.com',
      'www.ogabassey.com',
    ]);
  });

  it('deduplicates hostnames resolved through slug and custom domain', () => {
    expect(
      buildStorefrontPublicationPurgeHostnames(['ogabassey', 'OGABASSEY.COM'])
    ).toEqual(['ogabassey.com', 'www.ogabassey.com']);
  });

  it('returns no hostnames without a public cache policy', () => {
    expect(buildStorefrontPublicationPurgeHostnames(['another-shop'])).toEqual(
      []
    );
  });
});
