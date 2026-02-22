import { describe, expect, it, vi } from 'vitest';

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

vi.mock('next/headers', () => ({
  headers: vi.fn(() =>
    Promise.resolve({
      get: vi.fn(() => 'test-nonce'),
    })
  ),
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
    // Only Play Store URL since appStoreUrl is empty
    expect(storefrontSchema?.installUrl).toEqual([
      mockMobileApps.storefront.playStoreUrl,
    ]);
  });

  it('omits storefront schema when no store URLs exist', async () => {
    const originalPlayStore = mockMobileApps.storefront.playStoreUrl;
    mockMobileApps.storefront.playStoreUrl = '';

    const result = await RootDynamicHead();
    const schemas = getScriptContents(result);

    // Should only have 3 base + 1 admin = 4 schemas
    expect(schemas.length).toBe(4);
    const storefrontSchema = schemas.find(
      (s) =>
        s['@type'] === 'MobileApplication' &&
        s.name === mockMobileApps.storefront.name
    );
    expect(storefrontSchema).toBeUndefined();

    mockMobileApps.storefront.playStoreUrl = originalPlayStore;
  });

  it('omits installUrl from admin schema when no store URLs exist', async () => {
    const origApp = mockMobileApps.admin.appStoreUrl;
    const origPlay = mockMobileApps.admin.playStoreUrl;
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

    mockMobileApps.admin.appStoreUrl = origApp;
    mockMobileApps.admin.playStoreUrl = origPlay;
  });
});
