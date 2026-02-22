import { afterEach, describe, expect, it, vi } from 'vitest';

const mockMobileApps = vi.hoisted(() => ({
  admin: {
    name: 'Baci - The Ecommerce Builder',
    iosAppId: '6757810806',
    iosBundleId: 'com.ogabassey.baci',
    androidPackage: 'com.ogabassey.baci',
    appStoreUrl: 'https://apps.apple.com/app/id6757810806',
    playStoreUrl:
      'https://play.google.com/store/apps/details?id=com.ogabassey.baci',
  },
  storefront: {
    name: 'Ogabassey - Easybuy Gadgets',
    iosAppId: '',
    iosBundleId: 'com.ogabassey.store',
    androidPackage: 'com.ogabassey.store',
    appStoreUrl: '',
    playStoreUrl:
      'https://play.google.com/store/apps/details?id=com.ogabassey.store',
  },
}));

const mockHeaders = vi.hoisted(() =>
  vi.fn(() =>
    Promise.resolve({
      get: vi.fn(() => 'test-nonce'),
    })
  )
);

vi.mock('next/headers', () => ({
  headers: mockHeaders,
}));
vi.mock('@/config/platform', () => ({
  PLATFORM_CONFIG: {
    name: 'Baci',
    url: 'https://usebaci.com',
    description: 'AI-powered e-commerce',
  },
  PLATFORM_PRICING: {
    plans: [],
  },
  MOBILE_APPS: mockMobileApps,
}));
vi.mock('@/lib/sanitize-json-ld', () => ({
  safeJsonLdStringify: vi.fn((obj: unknown) => JSON.stringify(obj)),
}));
vi.mock('@/lib/seo-utils', () => ({
  generateOrganizationSchema: vi.fn(() => ({ '@type': 'Organization' })),
  generateWebSiteSchema: vi.fn(() => ({ '@type': 'WebSite' })),
  generateSoftwareApplicationSchema: vi.fn(() => ({
    '@type': 'SoftwareApplication',
  })),
}));

import { RootDynamicHead } from './root-dynamic-head';

function getScriptContents(
  result: React.JSX.Element
): Record<string, unknown>[] {
  const children = (result.props as { children: React.JSX.Element[] }).children;
  const scripts = Array.isArray(children) ? children.flat() : [children];
  return scripts.map((script: React.JSX.Element) => {
    const html = (
      script.props as { dangerouslySetInnerHTML: { __html: string } }
    ).dangerouslySetInnerHTML.__html;
    return JSON.parse(html) as Record<string, unknown>;
  });
}

describe('RootDynamicHead', () => {
  afterEach(() => {
    // Reset to defaults after each test to prevent cross-test pollution
    mockMobileApps.admin.appStoreUrl =
      'https://apps.apple.com/app/id6757810806';
    mockMobileApps.admin.playStoreUrl =
      'https://play.google.com/store/apps/details?id=com.ogabassey.baci';
    mockMobileApps.storefront.appStoreUrl = '';
    mockMobileApps.storefront.playStoreUrl =
      'https://play.google.com/store/apps/details?id=com.ogabassey.store';
    mockHeaders.mockImplementation(() =>
      Promise.resolve({
        get: vi.fn(() => 'test-nonce'),
      })
    );
  });

  it('is an async server component that returns JSX', async () => {
    const result = await RootDynamicHead();
    expect(result).toBeDefined();
  });

  it('renders Organization, WebSite, SoftwareApplication, and MobileApplication schemas', async () => {
    const result = await RootDynamicHead();
    const schemas = getScriptContents(result);

    // 3 base schemas + 2 mobile app schemas (admin + storefront)
    expect(schemas.length).toBe(5);
    expect(schemas[0]).toEqual({ '@type': 'Organization' });
    expect(schemas[1]).toEqual({ '@type': 'WebSite' });
    expect(schemas[2]).toEqual({ '@type': 'SoftwareApplication' });
  });

  it('includes both App Store and Play Store URLs in admin installUrl', async () => {
    const result = await RootDynamicHead();
    const schemas = getScriptContents(result);
    const adminSchema = schemas.find(
      (s) =>
        s['@type'] === 'MobileApplication' &&
        s.name === mockMobileApps.admin.name
    );

    expect(adminSchema).toBeDefined();
    expect(adminSchema?.operatingSystem).toBe('iOS, Android');
    expect(adminSchema?.installUrl).toEqual([
      mockMobileApps.admin.appStoreUrl,
      mockMobileApps.admin.playStoreUrl,
    ]);
  });

  it('includes storefront schema when playStoreUrl is present', async () => {
    const result = await RootDynamicHead();
    const schemas = getScriptContents(result);
    const storefrontSchema = schemas.find(
      (s) =>
        s['@type'] === 'MobileApplication' &&
        s.name === mockMobileApps.storefront.name
    );

    expect(storefrontSchema).toBeDefined();
    expect(storefrontSchema?.applicationCategory).toBe('ShoppingApplication');
    // Only Android since appStoreUrl is empty
    expect(storefrontSchema?.operatingSystem).toBe('Android');
    expect(storefrontSchema?.installUrl).toEqual([
      mockMobileApps.storefront.playStoreUrl,
    ]);
  });

  it('shows iOS only when admin has only appStoreUrl', async () => {
    mockMobileApps.admin.playStoreUrl = '';

    const result = await RootDynamicHead();
    const schemas = getScriptContents(result);
    const adminSchema = schemas.find(
      (s) =>
        s['@type'] === 'MobileApplication' &&
        s.name === mockMobileApps.admin.name
    );

    expect(adminSchema).toBeDefined();
    expect(adminSchema?.operatingSystem).toBe('iOS');
    expect(adminSchema?.installUrl).toEqual([mockMobileApps.admin.appStoreUrl]);
  });

  it('omits storefront schema when no store URLs exist', async () => {
    mockMobileApps.storefront.playStoreUrl = '';

    const result = await RootDynamicHead();
    const schemas = getScriptContents(result);

    expect(schemas.length).toBe(4);
    const storefrontSchema = schemas.find(
      (s) =>
        s['@type'] === 'MobileApplication' &&
        s.name === mockMobileApps.storefront.name
    );
    expect(storefrontSchema).toBeUndefined();
  });

  it('omits installUrl and operatingSystem from admin schema when no store URLs exist', async () => {
    mockMobileApps.admin.appStoreUrl = '';
    mockMobileApps.admin.playStoreUrl = '';

    const result = await RootDynamicHead();
    const schemas = getScriptContents(result);
    const adminSchema = schemas.find(
      (s) =>
        s['@type'] === 'MobileApplication' &&
        s.name === mockMobileApps.admin.name
    );

    expect(adminSchema).toBeDefined();
    expect(adminSchema?.installUrl).toBeUndefined();
    expect(adminSchema?.operatingSystem).toBeUndefined();
  });

  it('propagates errors when headers() throws', async () => {
    mockHeaders.mockImplementation(() => {
      throw new Error('headers unavailable');
    });

    await expect(RootDynamicHead()).rejects.toThrow('headers unavailable');
  });
});
