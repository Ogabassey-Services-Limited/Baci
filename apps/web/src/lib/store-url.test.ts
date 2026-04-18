import { buildRequestScopedStoreUrl, buildStoreUrl } from '@/lib/store-url';

describe('buildStoreUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('development mode', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'development');
    });

    it('returns localhost URL with slug baked in', () => {
      expect(
        buildStoreUrl({ slug: 'ogabassey', custom_domain: undefined })
      ).toBe('http://localhost:3000/ogabassey');
    });

    it('ignores custom_domain in dev mode', () => {
      expect(
        buildStoreUrl({ slug: 'ogabassey', custom_domain: 'ogabassey.com' })
      ).toBe('http://localhost:3000/ogabassey');
    });
  });

  describe('production mode', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'production');
    });

    it('returns custom domain origin when valid', () => {
      expect(
        buildStoreUrl({ slug: 'ogabassey', custom_domain: 'ogabassey.com' })
      ).toBe('https://ogabassey.com');
    });

    it('strips https:// protocol prefix from custom_domain', () => {
      expect(
        buildStoreUrl({
          slug: 'x',
          custom_domain: 'https://shop.example.com',
        })
      ).toBe('https://shop.example.com');
    });

    it('strips http:// protocol prefix from custom_domain', () => {
      expect(
        buildStoreUrl({
          slug: 'x',
          custom_domain: 'http://shop.example.com',
        })
      ).toBe('https://shop.example.com');
    });

    it('strips trailing slashes from custom_domain', () => {
      const url = buildStoreUrl({
        slug: 'x',
        custom_domain: 'ogabassey.com/',
      });
      expect(url).toBe('https://ogabassey.com');
      expect(url.endsWith('/')).toBe(false);
    });

    it('falls back to subdomain when custom_domain is undefined', () => {
      expect(
        buildStoreUrl({ slug: 'ogabassey', custom_domain: undefined })
      ).toBe('https://ogabassey.usebaci.com');
    });

    it('falls back to subdomain when custom_domain is empty string', () => {
      expect(buildStoreUrl({ slug: 'ogabassey', custom_domain: '' })).toBe(
        'https://ogabassey.usebaci.com'
      );
    });

    it('falls back to subdomain when custom_domain is invalid', () => {
      expect(
        buildStoreUrl({ slug: 'ogabassey', custom_domain: 'not a domain' })
      ).toBe('https://ogabassey.usebaci.com');
    });

    it('falls back to subdomain when custom_domain is just whitespace', () => {
      expect(buildStoreUrl({ slug: 'ogabassey', custom_domain: '   ' })).toBe(
        'https://ogabassey.usebaci.com'
      );
    });

    it('respects NEXT_PUBLIC_ROOT_DOMAIN env var', async () => {
      vi.resetModules();
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('NEXT_PUBLIC_ROOT_DOMAIN', 'custom.io');
      const { buildStoreUrl: freshBuild } = await import('@/lib/store-url');
      expect(freshBuild({ slug: 'mystore', custom_domain: undefined })).toBe(
        'https://mystore.custom.io'
      );
    });

    it('returns no trailing slash for any mode', () => {
      const subdomain = buildStoreUrl({
        slug: 'ogabassey',
        custom_domain: undefined,
      });
      const custom = buildStoreUrl({
        slug: 'ogabassey',
        custom_domain: 'ogabassey.com',
      });
      expect(subdomain.endsWith('/')).toBe(false);
      expect(custom.endsWith('/')).toBe(false);
    });
  });
});

describe('buildRequestScopedStoreUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses the custom domain header when present', () => {
    vi.stubEnv('NODE_ENV', 'development');

    const url = buildRequestScopedStoreUrl(
      { slug: 'ogabassey', custom_domain: 'ogabassey.com' },
      new Headers([
        ['host', '127.0.0.1:3217'],
        ['x-custom-domain', 'ogabassey.com'],
      ])
    );

    expect(url).toBe('https://ogabassey.com');
  });

  it('ignores mismatched custom domain headers', () => {
    vi.stubEnv('NODE_ENV', 'production');

    const url = buildRequestScopedStoreUrl(
      { slug: 'ogabassey', custom_domain: 'ogabassey.com' },
      new Headers([
        ['host', 'stale-host.example'],
        ['x-custom-domain', 'attacker.example'],
      ])
    );

    expect(url).toBe('https://ogabassey.com');
  });

  it('uses the current subdomain host for non-local requests', () => {
    vi.stubEnv('NODE_ENV', 'production');

    const url = buildRequestScopedStoreUrl(
      { slug: 'ogabassey', custom_domain: undefined },
      new Headers([['host', 'ogabassey.usebaci.com']])
    );

    expect(url).toBe('https://ogabassey.usebaci.com');
  });

  it('keeps localhost path-based storefront URLs in development', () => {
    vi.stubEnv('NODE_ENV', 'development');

    const url = buildRequestScopedStoreUrl(
      { slug: 'ogabassey', custom_domain: 'ogabassey.com' },
      new Headers([['host', '127.0.0.1:3217']])
    );

    expect(url).toBe('http://127.0.0.1:3217/ogabassey');
  });

  it('falls back to the merchant storefront origin when the current host is unrelated', () => {
    vi.stubEnv('NODE_ENV', 'production');

    const url = buildRequestScopedStoreUrl(
      { slug: 'ogabassey', custom_domain: 'ogabassey.com' },
      new Headers([['host', 'stale-host.example']])
    );

    expect(url).toBe('https://ogabassey.com');
  });
});
