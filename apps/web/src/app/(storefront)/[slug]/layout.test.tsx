import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getRequestScopedMerchant } from '@/lib/cached-data';
import {
  getStorefrontShellSnapshot,
  getStorefrontShellSnapshotBase,
} from './storefront-shell-snapshot';

const providerSnapshots: unknown[] = [];
let themeProviderRenders = 0;
const mockOgabasseyStorefrontLayout = vi.hoisted(() =>
  vi.fn(
    ({
      children,
      preloadHeroLcpImages,
    }: {
      children: ReactNode;
      preloadHeroLcpImages?: boolean;
    }) => (
      <div
        data-preload-hero-lcp={String(Boolean(preloadHeroLcpImages))}
        data-testid="ogabassey-layout"
      >
        {children}
      </div>
    )
  )
);
const mockStorefrontHeroPreloadDecision = vi.hoisted(() => vi.fn(() => null));

vi.mock('./storefront-shell-snapshot', () => ({
  getStorefrontShellSnapshotBase: vi.fn(),
  getStorefrontShellSnapshot: vi.fn(),
}));

vi.mock('@/components/storefront/ogabassey/storefront-layout', () => ({
  OgabasseyStorefrontLayout: mockOgabasseyStorefrontLayout,
}));

vi.mock('./storefront-hero-preload-decision', () => ({
  StorefrontHeroPreloadDecision: mockStorefrontHeroPreloadDecision,
}));

vi.mock('@/components/storefront/deferred-page-view-tracker', () => ({
  DeferredPageViewTracker: () => <div data-testid="page-view-tracker" />,
}));

vi.mock('@/components/storefront/store-not-published', () => ({
  StoreNotPublished: ({ businessName }: { businessName: string }) => (
    <div>{businessName} unpublished</div>
  ),
}));

vi.mock('@/components/storefront/storefront-theme-provider', () => ({
  StorefrontThemeProvider: ({ children }: { children: ReactNode }) => {
    themeProviderRenders += 1;
    return <div data-testid="storefront-theme-provider">{children}</div>;
  },
}));

vi.mock('@/hooks/cart/storefront-cart-provider', () => ({
  StorefrontCartProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('@/hooks/merchant/storefront-merchant-provider', () => ({
  StorefrontMerchantProvider: ({
    children,
    shellSnapshot,
  }: {
    children: ReactNode;
    shellSnapshot: unknown;
  }) => {
    providerSnapshots.push(shellSnapshot);
    return <>{children}</>;
  },
}));

vi.mock('@/lib/cached-data', () => ({
  getRequestScopedMerchant: vi.fn(),
}));

const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});

vi.mock('next/navigation', () => ({
  notFound: () => notFound(),
}));

vi.mock('@/lib/store-url', () => ({
  buildRequestScopedStoreUrl: (merchant: {
    slug: string;
    custom_domain?: string | null;
  }) =>
    merchant.custom_domain
      ? `https://${merchant.custom_domain}`
      : `https://${merchant.slug}.usebaci.com`,
}));

vi.mock('@/lib/validation', () => ({
  isDomainIdentifier: (value: string) => value.includes('.'),
  isValidMerchantIdentifier: () => true,
}));

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });

  return { promise, resolve };
}

const baseMerchant = {
  id: 'merchant-1',
  slug: 'ogabassey',
  custom_domain: 'ogabassey.com',
  business_name: 'Ogabassey',
  site_title: 'Ogabassey | Buy Gadgets Pay Later',
  site_description: 'Store description',
  site_tagline: 'Store tagline',
  business_type: 'electronics',
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

const baseShellSnapshot = {
  merchant: {
    id: 'merchant-1',
    user_id: '',
    business_name: 'Ogabassey',
    business_type: 'electronics',
    slug: 'ogabassey',
    custom_domain: 'ogabassey.com',
    template_id: 'ogabassey',
    is_published: true,
  },
  routingMode: 'path' as const,
  basePath: '/ogabassey',
  navigationCategories: [{ name: 'Phones', slug: 'phones' }],
};

const baseShellSnapshotWithoutCategories = {
  merchant: baseShellSnapshot.merchant,
  routingMode: baseShellSnapshot.routingMode,
  basePath: baseShellSnapshot.basePath,
};

const { generateMetadata, generateViewport, StorefrontLayoutContent } =
  await import('./layout');

describe('storefront layout', () => {
  beforeEach(() => {
    vi.mocked(getRequestScopedMerchant).mockReset();
    vi.mocked(getStorefrontShellSnapshotBase).mockReset();
    vi.mocked(getStorefrontShellSnapshot).mockReset();
    notFound.mockClear();
    mockOgabasseyStorefrontLayout.mockClear();
    mockStorefrontHeroPreloadDecision.mockClear();
    providerSnapshots.length = 0;
    themeProviderRenders = 0;
  });

  it('waits for the shell snapshot and keeps the first-render merchant shell contract observable', async () => {
    const deferredSnapshot = createDeferred<typeof baseShellSnapshot>();

    vi.mocked(getStorefrontShellSnapshotBase).mockResolvedValue(
      baseShellSnapshotWithoutCategories
    );
    vi.mocked(getStorefrontShellSnapshot).mockReturnValue(
      deferredSnapshot.promise
    );

    const layoutPromise = StorefrontLayoutContent({
      params: Promise.resolve({ slug: 'ogabassey' }),
      children: <main>Storefront content</main>,
    });

    let settled = false;
    void layoutPromise.then(() => {
      settled = true;
    });

    await waitFor(() => {
      expect(getStorefrontShellSnapshotBase).toHaveBeenCalledWith('ogabassey');
    });
    expect(getStorefrontShellSnapshot).toHaveBeenCalledWith(
      baseShellSnapshotWithoutCategories
    );

    await Promise.resolve();
    expect(settled).toBe(false);

    deferredSnapshot.resolve(baseShellSnapshot);
    render(await layoutPromise);

    expect(providerSnapshots).toEqual([baseShellSnapshot]);
    expect(screen.getByTestId('ogabassey-layout')).toHaveAttribute(
      'data-preload-hero-lcp',
      'false'
    );
    expect(mockStorefrontHeroPreloadDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        merchantSlug: 'ogabassey',
        routeSlug: 'ogabassey',
        templateId: 'ogabassey',
      }),
      undefined
    );
    expect(themeProviderRenders).toBe(0);
    expect(screen.getByText('Storefront content')).toBeInTheDocument();
  });

  it('can disable the dynamic hero preload decision for routes with static hints', async () => {
    vi.mocked(getStorefrontShellSnapshotBase).mockResolvedValue(
      baseShellSnapshotWithoutCategories
    );
    vi.mocked(getStorefrontShellSnapshot).mockResolvedValue(baseShellSnapshot);

    render(
      await StorefrontLayoutContent({
        enableDynamicHeroPreloadDecision: false,
        params: Promise.resolve({ slug: 'ogabassey' }),
        children: <main>Storefront content</main>,
      })
    );

    expect(screen.getByTestId('ogabassey-layout')).toHaveAttribute(
      'data-preload-hero-lcp',
      'false'
    );
    expect(mockStorefrontHeroPreloadDecision).not.toHaveBeenCalled();
  });

  it('calls notFound before route content renders when the shell snapshot is missing', async () => {
    vi.mocked(getStorefrontShellSnapshotBase).mockResolvedValue(null);

    await expect(
      StorefrontLayoutContent({
        params: Promise.resolve({ slug: 'missing-store' }),
        children: <main>Storefront content</main>,
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(notFound).toHaveBeenCalledTimes(1);
    expect(themeProviderRenders).toBe(0);
    expect(providerSnapshots).toEqual([]);
  });

  it('renders StoreNotPublished outside development without waiting on category work', async () => {
    const deferredSnapshot = createDeferred<typeof baseShellSnapshot>();

    vi.mocked(getStorefrontShellSnapshotBase).mockResolvedValue({
      ...baseShellSnapshotWithoutCategories,
      merchant: {
        ...baseShellSnapshotWithoutCategories.merchant,
        business_name: 'Draft Store',
        is_published: false,
      },
    });
    vi.mocked(getStorefrontShellSnapshot).mockReturnValue(
      deferredSnapshot.promise
    );

    render(
      await StorefrontLayoutContent({
        params: Promise.resolve({ slug: 'draft-store' }),
        children: <main>Storefront content</main>,
      })
    );

    expect(screen.getByText('Draft Store unpublished')).toBeInTheDocument();
    expect(screen.queryByText('Storefront content')).not.toBeInTheDocument();
    expect(themeProviderRenders).toBe(0);
    expect(getStorefrontShellSnapshot).not.toHaveBeenCalled();
    expect(providerSnapshots).toEqual([]);
  });
});

describe('storefront layout metadata', () => {
  beforeEach(() => {
    vi.mocked(getRequestScopedMerchant).mockReset();
  });

  it('uses the merchant domain as metadataBase for custom domains', async () => {
    vi.mocked(getRequestScopedMerchant).mockResolvedValue(
      baseMerchant as unknown as Awaited<
        ReturnType<typeof getRequestScopedMerchant>
      >
    );

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'ogabassey' }),
    });

    expect(metadata.metadataBase?.toString()).toBe('https://ogabassey.com/');
  });

  it('falls back to the slug-based storefront URL when no custom domain exists', async () => {
    vi.mocked(getRequestScopedMerchant).mockResolvedValue({
      ...baseMerchant,
      business_name: 'Test Store',
      slug: 'test-store',
      custom_domain: null,
      site_title: 'Test Store',
    } as unknown as Awaited<ReturnType<typeof getRequestScopedMerchant>>);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'test-store' }),
    });

    expect(metadata.metadataBase?.toString()).toBe(
      'https://test-store.usebaci.com/'
    );
  });

  it('leaves route-level alternates to page metadata', async () => {
    vi.mocked(getRequestScopedMerchant).mockResolvedValue(
      baseMerchant as unknown as Awaited<
        ReturnType<typeof getRequestScopedMerchant>
      >
    );

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'ogabassey' }),
    });

    expect(metadata.alternates).toBeUndefined();
  });

  it('uses industry-aware fallback metadata for food stores', async () => {
    vi.mocked(getRequestScopedMerchant).mockResolvedValue({
      ...baseMerchant,
      business_name: 'Foodflow',
      business_type: 'food-beverage',
      custom_domain: null,
      site_title: null,
      site_description: null,
      site_tagline: null,
    } as unknown as Awaited<ReturnType<typeof getRequestScopedMerchant>>);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'foodflow' }),
    });

    expect(metadata.title).toBe('Foodflow | Order Fresh Food Online');
    expect(metadata.description).toBe(
      'Shop Foodflow - order fresh food online with secure checkout in Nigeria.'
    );
  });

  it('replaces mismatched gadget fallback titles for non-electronics stores', async () => {
    vi.mocked(getRequestScopedMerchant).mockResolvedValue({
      ...baseMerchant,
      business_name: 'Medplus',
      business_type: 'pharmaceuticals',
      custom_domain: null,
      site_title: 'Medplus | Buy Gadgets Pay Later',
      site_description: null,
      site_tagline: null,
    } as unknown as Awaited<ReturnType<typeof getRequestScopedMerchant>>);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'medplus' }),
    });

    expect(metadata.title).toBe('Medplus | Shop Pharmacy Essentials Online');
  });

  it('reads google verification from published_config when feature settings omit it', async () => {
    vi.mocked(getRequestScopedMerchant).mockResolvedValue({
      ...baseMerchant,
      slug: 'test-store',
      custom_domain: null,
      site_title: 'Test Store',
      feature_settings: {},
      published_config: {
        google_site_verification: 'google-verification-token',
      },
    } as unknown as Awaited<ReturnType<typeof getRequestScopedMerchant>>);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'test-store' }),
    });

    expect(metadata.verification).toEqual({
      google: 'google-verification-token',
    });
  });

  it('keeps the static viewport configuration unchanged', () => {
    expect(generateViewport()).toEqual({
      width: 'device-width',
      initialScale: 1,
    });
  });
});
