import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCachedStorefrontHomeProducts } from '@/lib/cached-data';

// Mock server-only dependencies
vi.mock('@/lib/cached-data', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getCachedStorefrontHomeProducts: vi.fn(() => Promise.resolve([])),
  };
});
vi.mock('@/lib/cached-categories', () => ({
  getCachedNavigationCategories: vi.fn(() => Promise.resolve([])),
}));
vi.mock('@/templates/registry', () => ({
  getTemplate: vi.fn(() => null),
  getTemplateIdByBusinessType: vi.fn(() => null),
}));
vi.mock('./resolve-storefront-template', () => ({
  resolveStorefrontTemplateId: vi.fn(() => null),
}));
vi.mock('./storefront-wrapper', () => ({
  StorefrontWrapper: ({ products }: { products: unknown[] }) => (
    <div data-testid="storefront-wrapper">
      Products: {Array.isArray(products) ? products.length : 0}
    </div>
  ),
}));
vi.mock('@/components/analytics/analytics-provider', () => ({
  AnalyticsProvider: () => null,
}));
vi.mock('@/components/ui/skeletons', () => ({
  StorefrontPageSkeleton: () => <div data-testid="skeleton">Loading...</div>,
}));
const mockHeaders = vi.fn();
vi.mock('next/headers', () => ({
  headers: () => mockHeaders(),
}));

import type { CachedMerchant } from '@/lib/cached-data';
import {
  StorefrontContent,
  StreamingStorefrontContent,
} from './storefront-content';

function createMockMerchant(): CachedMerchant {
  return {
    id: 'merchant-1',
    business_name: 'Test Store',
    business_type: 'general',
    email: 'test@example.com',
    phone: '+2341234567',
    logo_url: '',
    brand_colors: undefined,
    country: 'NG',
    pages: undefined,
    slug: 'test-store',
    custom_domain: undefined,
    favicon_svg_url: undefined,
    favicon_png_32_url: undefined,
    favicon_apple_touch_url: undefined,
    social_media: undefined,
    business_address: '',
    is_published: true,
    feature_settings: undefined,
    template_id: '',
    vat_registration_status: undefined,
    vat_rate: undefined,
    hero_slides: undefined,
    mobile_hero_slides: undefined,
    site_title: '',
    site_tagline: '',
    site_description: '',
    payout_currency: 'NGN',
    plan_tier: 'free',
    premium_features: undefined,
  };
}

const mockMerchant = createMockMerchant();

afterEach(() => {
  vi.resetAllMocks();
  vi.restoreAllMocks();
});

describe('StorefrontContent', () => {
  beforeEach(() => {
    mockHeaders.mockReset();
    mockHeaders.mockResolvedValue(new Headers());
  });

  it('renders the fallback StorefrontWrapper when no template matches', async () => {
    const result = await StorefrontContent({ merchant: mockMerchant });

    render(result as React.ReactElement);
    expect(screen.getByText(/Products: \d+/)).toBeInTheDocument();
  });

  it('renders template Home component when template is resolved', async () => {
    const { resolveStorefrontTemplateId } = await import(
      './resolve-storefront-template'
    );
    const { getTemplate } = await import('@/templates/registry');

    vi.mocked(resolveStorefrontTemplateId).mockReturnValue('ogabassey');
    vi.mocked(getTemplate).mockReturnValue({
      getComponents: () =>
        Promise.resolve({
          Home: (props: Record<string, unknown>) => (
            <div data-testid="template-home">{String(props.storeSlug)}</div>
          ),
        }),
    } as ReturnType<typeof getTemplate>);

    const result = await StorefrontContent({ merchant: mockMerchant });
    render(result as React.ReactElement);

    expect(screen.getByTestId('template-home')).toBeInTheDocument();
    expect(screen.getByText('test-store')).toBeInTheDocument();
  });

  it('falls back to StorefrontWrapper when template render throws', async () => {
    const { resolveStorefrontTemplateId } = await import(
      './resolve-storefront-template'
    );
    const { getTemplate } = await import('@/templates/registry');

    vi.mocked(resolveStorefrontTemplateId).mockReturnValue('ogabassey');
    vi.mocked(getTemplate).mockReturnValue({
      getComponents: () => Promise.reject(new Error('render failure')),
    } as ReturnType<typeof getTemplate>);

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(
      // intentionally suppress console.error during test
      () => undefined
    );

    const result = await StorefrontContent({ merchant: mockMerchant });
    render(result as React.ReactElement);

    expect(screen.getByText(/Products: \d+/)).toBeInTheDocument();
    consoleSpy.mockRestore();
  });

  it('emits collection schema for homepage featured products', async () => {
    vi.mocked(getCachedStorefrontHomeProducts).mockResolvedValue([
      {
        id: 'product-1',
        name: 'Galaxy Fold',
        description: '<p>Premium foldable phone.</p>',
        status: 'active',
        price: 1200000,
        manage_stock: false,
        stock: 3,
        image: 'https://cdn.example.com/fold.jpg',
        imageLarge: 'https://cdn.example.com/fold-large.jpg',
        imageHint: 'fold',
        category: 'Smartphones',
        slug: 'galaxy-fold',
      },
    ] as never);

    const result = await StorefrontContent({ merchant: mockMerchant });

    render(result as React.ReactElement);

    const schemaScript = document.querySelector(
      'script[type="application/ld+json"]'
    );
    expect(schemaScript).not.toBeNull();

    const schema = JSON.parse(schemaScript?.textContent || '{}') as {
      '@type': string;
      mainEntity?: { '@type': string };
    };

    expect(schema['@type']).toBe('CollectionPage');
    expect(schema.mainEntity?.['@type']).toBe('ItemList');
  });
});

describe('StreamingStorefrontContent', () => {
  it('renders a Suspense fallback skeleton', () => {
    render(<StreamingStorefrontContent merchant={mockMerchant} />);

    // The Suspense boundary should show the skeleton while the async content loads
    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  });
});
