import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getRequestScopedMerchant } from '@/lib/cached-data';
import {
  getStorefrontShellSnapshot,
  getStorefrontShellSnapshotBase,
} from './storefront-shell-snapshot';

const providerSnapshots: unknown[] = [];

vi.mock('./storefront-shell-snapshot', () => ({
  getStorefrontShellSnapshotBase: vi.fn(),
  getStorefrontShellSnapshot: vi.fn(),
}));

vi.mock('@/components/storefront/ogabassey/storefront-layout', () => ({
  OgabasseyStorefrontLayout: ({ children }: { children: ReactNode }) => (
    <div data-testid="ogabassey-layout">{children}</div>
  ),
}));

vi.mock('@/components/storefront/deferred-page-view-tracker', () => ({
  DeferredPageViewTracker: () => <div data-testid="page-view-tracker" />,
}));

vi.mock('@/components/storefront/store-not-published', () => ({
  StoreNotPublished: ({ businessName }: { businessName: string }) => (
    <div>{businessName} unpublished</div>
  ),
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

const mockHeaders = vi.fn();
const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});

vi.mock('next/headers', () => ({
  headers: () => mockHeaders(),
}));

vi.mock('next/navigation', () => ({
  notFound: () => notFound(),
}));

vi.mock('@/lib/store-url', () => ({
  buildRequestScopedStoreUrl: (
    merchant: { slug: string; custom_domain?: string },
    _headers: Headers
  ) =>
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

const {
  default: StorefrontLayout,
  generateMetadata,
  generateViewport,
} = await import('./layout');

describe('storefront layout', () => {
  beforeEach(() => {
    vi.mocked(getRequestScopedMerchant).mockReset();
    vi.mocked(getStorefrontShellSnapshotBase).mockReset();
    vi.mocked(getStorefrontShellSnapshot).mockReset();
    mockHeaders.mockReset();
    notFound.mockClear();
    providerSnapshots.length = 0;
    mockHeaders.mockResolvedValue(new Headers());
  });

  it('waits for the shell snapshot and keeps the first-render merchant shell contract observable', async () => {
    const deferredSnapshot = createDeferred<typeof baseShellSnapshot>();

    vi.mocked(getStorefrontShellSnapshotBase).mockResolvedValue(
      baseShellSnapshotWithoutCategories
    );
    vi.mocked(getStorefrontShellSnapshot).mockReturnValue(
      deferredSnapshot.promise
    );

    const layoutPromise = StorefrontLayout({
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
    expect(screen.getByText('Storefront content')).toBeInTheDocument();
  });

  it('calls notFound before route content renders when the shell snapshot is missing', async () => {
    vi.mocked(getStorefrontShellSnapshotBase).mockResolvedValue(null);

    await expect(
      StorefrontLayout({
        params: Promise.resolve({ slug: 'missing-store' }),
        children: <main>Storefront content</main>,
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(notFound).toHaveBeenCalledTimes(1);
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
      await StorefrontLayout({
        params: Promise.resolve({ slug: 'draft-store' }),
        children: <main>Storefront content</main>,
      })
    );

    expect(screen.getByText('Draft Store unpublished')).toBeInTheDocument();
    expect(getStorefrontShellSnapshot).not.toHaveBeenCalled();
    expect(providerSnapshots).toEqual([]);
  });
});

describe('storefront layout metadata', () => {
  beforeEach(() => {
    vi.mocked(getRequestScopedMerchant).mockReset();
    mockHeaders.mockReset();
    mockHeaders.mockResolvedValue(new Headers());
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
