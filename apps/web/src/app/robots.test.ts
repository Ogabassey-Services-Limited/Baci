import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Mocks ----

let mockHost = 'localhost:3000';

vi.mock('next/headers', () => ({
  headers: vi.fn(() =>
    Promise.resolve({
      get: vi.fn((name: string) => {
        if (name === 'host') return mockHost;
        return null;
      }),
    })
  ),
}));

// ---- Tests ----

describe('robots()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHost = 'localhost:3000';
    // Reset env
    delete process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  });

  it('returns robots config with sitemap URL', async () => {
    const { default: robots } = await import('./robots');

    const result = await robots();

    expect(result.sitemap).toBe('http://localhost:3000/sitemap.xml');
    expect(result.rules).toBeDefined();
    expect(Array.isArray(result.rules)).toBe(true);
  });

  it('uses http protocol for localhost', async () => {
    const { default: robots } = await import('./robots');
    mockHost = 'localhost:3000';

    const result = await robots();

    expect(result.sitemap).toBe('http://localhost:3000/sitemap.xml');
  });

  it('uses https protocol for non-localhost hosts', async () => {
    const { default: robots } = await import('./robots');
    mockHost = 'ogabassey.usebaci.com';

    const result = await robots();

    expect(result.sitemap).toEqual([
      'https://ogabassey.usebaci.com/sitemap/static.xml',
      'https://ogabassey.usebaci.com/sitemap/products.xml',
      'https://ogabassey.usebaci.com/sitemap/categories.xml',
      'https://ogabassey.usebaci.com/blog/sitemap.xml',
    ]);
  });

  it('uses the root sitemap for the platform domain', async () => {
    const { default: robots } = await import('./robots');
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'usebaci.com';
    mockHost = 'usebaci.com';

    const result = await robots();

    expect(result.sitemap).toBe('https://usebaci.com/sitemap.xml');
  });

  it('includes platform disallows for platform domain', async () => {
    const { default: robots } = await import('./robots');
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'usebaci.com';
    mockHost = 'usebaci.com';

    const result = await robots();
    const defaultRule = Array.isArray(result.rules)
      ? result.rules[0]
      : result.rules;

    expect(defaultRule.disallow).toContain('/dashboard/');
    expect(defaultRule.disallow).toContain('/onboarding/');
    expect(defaultRule.disallow).toContain('/auth/');
    expect(defaultRule.disallow).toContain('/api/');
  });

  it('includes platform disallows for www subdomain', async () => {
    const { default: robots } = await import('./robots');
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'usebaci.com';
    mockHost = 'www.usebaci.com';

    const result = await robots();
    const defaultRule = Array.isArray(result.rules)
      ? result.rules[0]
      : result.rules;

    expect(defaultRule.disallow).toContain('/dashboard/');
    expect(defaultRule.disallow).toContain('/onboarding/');
  });

  it('uses minimal disallows for merchant subdomains', async () => {
    const { default: robots } = await import('./robots');
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'usebaci.com';
    mockHost = 'ogabassey.usebaci.com';

    const result = await robots();
    const defaultRule = Array.isArray(result.rules)
      ? result.rules[0]
      : result.rules;
    const disallows = defaultRule.disallow as string[];

    expect(disallows).toContain('/api/');
    expect(disallows).toContain('/_next/');
    expect(disallows).toContain('/checkout/');
    expect(disallows).toContain('/account/login/');
    // Should NOT include platform paths
    expect(disallows).not.toContain('/dashboard/');
    expect(disallows).not.toContain('/onboarding/');
    expect(disallows).not.toContain('/auth/');
    expect(result.sitemap).toEqual([
      'https://ogabassey.usebaci.com/sitemap/static.xml',
      'https://ogabassey.usebaci.com/sitemap/products.xml',
      'https://ogabassey.usebaci.com/sitemap/categories.xml',
      'https://ogabassey.usebaci.com/blog/sitemap.xml',
    ]);
  });

  it('uses minimal disallows for custom domains', async () => {
    const { default: robots } = await import('./robots');
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'usebaci.com';
    mockHost = 'shop.ogabassey.com';

    const result = await robots();
    const defaultRule = Array.isArray(result.rules)
      ? result.rules[0]
      : result.rules;
    const disallows = defaultRule.disallow as string[];

    expect(disallows).toContain('/api/');
    expect(disallows).not.toContain('/dashboard/');
    expect(result.sitemap).toEqual([
      'https://shop.ogabassey.com/sitemap/static.xml',
      'https://shop.ogabassey.com/sitemap/products.xml',
      'https://shop.ogabassey.com/sitemap/categories.xml',
      'https://shop.ogabassey.com/blog/sitemap.xml',
    ]);
  });

  it('treats localhost as platform domain', async () => {
    const { default: robots } = await import('./robots');
    mockHost = 'localhost:3000';

    const result = await robots();
    const defaultRule = Array.isArray(result.rules)
      ? result.rules[0]
      : result.rules;

    expect(defaultRule.disallow).toContain('/dashboard/');
  });

  it('includes AI bot user agents', async () => {
    const { default: robots } = await import('./robots');

    const result = await robots();
    const rules = result.rules as Array<{ userAgent: string }>;
    const agents = rules.map((r) => r.userAgent);

    expect(agents).toContain('*');
    expect(agents).toContain('GPTBot');
    expect(agents).toContain('ClaudeBot');
    expect(agents).toContain('PerplexityBot');
    expect(agents).toContain('Google-Extended');
  });

  it('all rules allow root path', async () => {
    const { default: robots } = await import('./robots');

    const result = await robots();
    const rules = result.rules as Array<{ allow: string }>;

    for (const rule of rules) {
      expect(rule.allow).toBe('/');
    }
  });

  it('defaults root domain to usebaci.com when env not set', async () => {
    const { default: robots } = await import('./robots');
    delete process.env.NEXT_PUBLIC_ROOT_DOMAIN;
    mockHost = 'usebaci.com';

    const result = await robots();
    const defaultRule = Array.isArray(result.rules)
      ? result.rules[0]
      : result.rules;

    // Should be treated as platform domain
    expect(defaultRule.disallow).toContain('/dashboard/');
  });

  it('uses http for 127.0.0.1', async () => {
    const { default: robots } = await import('./robots');
    mockHost = '127.0.0.1:3000';

    const result = await robots();

    expect(result.sitemap).toBe('http://127.0.0.1:3000/sitemap.xml');
  });
});
