import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockSupabase = vi.hoisted(() => {
  const queryBuilder = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    ilike: vi.fn(),
    limit: vi.fn(),
  };

  queryBuilder.select.mockReturnValue(queryBuilder);
  queryBuilder.eq.mockReturnValue(queryBuilder);
  queryBuilder.order.mockReturnValue(queryBuilder);
  queryBuilder.ilike.mockReturnValue(queryBuilder);

  const from = vi.fn(() => queryBuilder);

  return {
    from,
    queryBuilder,
    createClient: vi.fn(() => ({
      from,
    })),
  };
});

// Mock server-only dependencies
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve(new Map())),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: mockSupabase.createClient,
}));
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

beforeEach(() => {
  mockSupabase.queryBuilder.limit.mockResolvedValue({
    data: [],
    error: null,
  });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('StorefrontContent', () => {
  it('renders the fallback StorefrontWrapper when no template matches', async () => {
    const result = await StorefrontContent({ merchant: mockMerchant });

    render(result as ReactElement);
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
    render(result as ReactElement);

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
    render(result as ReactElement);

    expect(screen.getByText(/Products: \d+/)).toBeInTheDocument();
    consoleSpy.mockRestore();
  });

  it('limits category-filtered queries and logs Supabase errors gracefully', async () => {
    mockSupabase.queryBuilder.limit.mockResolvedValueOnce({
      data: null,
      error: { message: 'db failed' },
    });

    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const result = await StorefrontContent({
      merchant: mockMerchant,
      categoryFilter: 'Laptops',
    });

    render(result as ReactElement);

    expect(mockSupabase.queryBuilder.ilike).toHaveBeenCalledWith(
      'category',
      'Laptops'
    );
    expect(mockSupabase.queryBuilder.limit).toHaveBeenCalledWith(200);
    expect(screen.getByText('Products: 0')).toBeInTheDocument();
    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to fetch storefront products:',
      expect.objectContaining({
        merchantId: mockMerchant.id,
        categoryFilter: 'Laptops',
        error: expect.objectContaining({ message: 'db failed' }),
      })
    );
  });
});

describe('StreamingStorefrontContent', () => {
  it('renders a Suspense fallback skeleton', () => {
    render(<StreamingStorefrontContent merchant={mockMerchant} />);

    // The Suspense boundary should show the skeleton while the async content loads
    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  });
});
