import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCachedNavigationCategories } from '@/lib/cached-categories';
import { getRequestScopedMerchant } from '@/lib/cached-data';

vi.mock('@/lib/cached-categories', () => ({
  getCachedNavigationCategories: vi.fn(),
}));

vi.mock('@/lib/cached-data', () => ({
  getRequestScopedMerchant: vi.fn(),
}));

const mockHeaders = vi.fn();
vi.mock('next/headers', () => ({
  headers: () => mockHeaders(),
}));

vi.mock('@/lib/validation', () => ({
  isDomainIdentifier: (value: string) => value.includes('.'),
}));

const baseMerchant = {
  id: 'merchant-1',
  slug: 'ogabassey',
  business_name: 'Ogabassey',
  business_type: 'electronics',
  custom_domain: 'ogabassey.com',
  site_title: 'Ogabassey',
  site_tagline: 'Store tagline',
  site_description: 'Store description',
  logo_url: null,
  phone: '+2348146978921',
  email: 'hello@ogabassey.com',
  social_media: {},
  brand_colors: undefined,
  business_address: '2 Olaide Tomori St, Ikeja, Lagos',
  payout_currency: 'NGN',
  is_published: true,
  template_id: 'ogabassey',
  plan_tier: 'pro',
  premium_features: null,
  country: 'NG',
  feature_settings: {},
  published_config: null,
  favicon_svg_url: null,
  favicon_png_32_url: null,
  favicon_apple_touch_url: null,
};

const { getStorefrontShellSnapshot, getStorefrontShellSnapshotBase } =
  await import('./storefront-shell-snapshot');

describe('getStorefrontShellSnapshot', () => {
  beforeEach(() => {
    vi.mocked(getRequestScopedMerchant).mockReset();
    vi.mocked(getCachedNavigationCategories).mockReset();
    mockHeaders.mockReset();
    mockHeaders.mockResolvedValue(new Headers());
  });

  it('returns path-routed shell data with a slug-based basePath on first render', async () => {
    vi.mocked(getRequestScopedMerchant).mockResolvedValue(
      baseMerchant as unknown as Awaited<
        ReturnType<typeof getRequestScopedMerchant>
      >
    );
    vi.mocked(getCachedNavigationCategories).mockResolvedValue([
      { name: 'Phones', slug: 'phones' },
    ]);

    const shellSnapshotBase = await getStorefrontShellSnapshotBase('ogabassey');
    expect(shellSnapshotBase).not.toBeNull();
    if (!shellSnapshotBase) {
      throw new Error('Expected shellSnapshotBase to be resolved');
    }
    const snapshot = await getStorefrontShellSnapshot(shellSnapshotBase);

    expect(snapshot).toMatchObject({
      merchant: {
        id: 'merchant-1',
        user_id: '',
        business_name: 'Ogabassey',
        slug: 'ogabassey',
      },
      routingMode: 'path',
      basePath: '/ogabassey',
      navigationCategories: [{ name: 'Phones', slug: 'phones' }],
    });
  });

  it('returns domain-routed shell data with an empty basePath on first render', async () => {
    vi.mocked(getRequestScopedMerchant).mockResolvedValue(
      baseMerchant as unknown as Awaited<
        ReturnType<typeof getRequestScopedMerchant>
      >
    );
    vi.mocked(getCachedNavigationCategories).mockResolvedValue([
      { name: 'Phones', slug: 'phones' },
    ]);
    mockHeaders.mockResolvedValue(new Headers([['x-custom-domain', '1']]));

    const shellSnapshotBase = await getStorefrontShellSnapshotBase('ogabassey');
    expect(shellSnapshotBase).not.toBeNull();
    if (!shellSnapshotBase) {
      throw new Error('Expected shellSnapshotBase to be resolved');
    }
    const snapshot = await getStorefrontShellSnapshot(shellSnapshotBase);

    expect(snapshot).toMatchObject({
      routingMode: 'domain',
      basePath: '',
      navigationCategories: [{ name: 'Phones', slug: 'phones' }],
      merchant: {
        slug: 'ogabassey',
      },
    });
    expect(getCachedNavigationCategories).toHaveBeenCalledWith('merchant-1');
  });

  it('treats slug subdomains as domain-routed even without x-merchant headers', async () => {
    vi.mocked(getRequestScopedMerchant).mockResolvedValue(
      baseMerchant as unknown as Awaited<
        ReturnType<typeof getRequestScopedMerchant>
      >
    );
    mockHeaders.mockResolvedValue(
      new Headers([['host', 'ogabassey.usebaci.com']])
    );

    const shellSnapshotBase = await getStorefrontShellSnapshotBase('ogabassey');

    expect(shellSnapshotBase).toMatchObject({
      routingMode: 'domain',
      basePath: '',
    });
  });

  it('expands a precomputed base snapshot without repeating merchant lookup work', async () => {
    const shellSnapshotBase = {
      merchant: {
        id: 'merchant-1',
        user_id: '',
        business_name: 'Ogabassey',
        business_type: 'electronics',
        slug: 'ogabassey',
        is_published: true,
      },
      routingMode: 'path' as const,
      basePath: '/ogabassey',
    };
    vi.mocked(getCachedNavigationCategories).mockResolvedValue([
      { name: 'Phones', slug: 'phones' },
    ]);

    const snapshot = await getStorefrontShellSnapshot(shellSnapshotBase);

    expect(snapshot).toEqual({
      ...shellSnapshotBase,
      navigationCategories: [{ name: 'Phones', slug: 'phones' }],
    });
    expect(getRequestScopedMerchant).not.toHaveBeenCalled();
  });

  it('can resolve the minimal shell snapshot without waiting on navigation categories', async () => {
    vi.mocked(getRequestScopedMerchant).mockResolvedValue({
      ...baseMerchant,
      is_published: false,
    } as unknown as Awaited<ReturnType<typeof getRequestScopedMerchant>>);

    const snapshot = await getStorefrontShellSnapshotBase('ogabassey');

    expect(snapshot).toMatchObject({
      merchant: {
        id: 'merchant-1',
        slug: 'ogabassey',
        is_published: false,
      },
      routingMode: 'path',
      basePath: '/ogabassey',
    });
    expect(getCachedNavigationCategories).not.toHaveBeenCalled();
  });
});
