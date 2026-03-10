import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mockMerchant = vi.hoisted(() => ({
  id: 'merchant-1',
  business_name: 'Ogabassey',
  business_type: 'general',
  email: 'support@ogabassey.com',
  phone: '+2348146978921',
  logo_url: '',
  brand_colors: undefined,
  country: 'NG',
  pages: undefined,
  slug: 'ogabassey',
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
}));

const mockStorefrontContent = vi.hoisted(() =>
  vi.fn(({ categoryFilter }: { categoryFilter?: string }) => (
    <main>
      <div>{categoryFilter ?? 'no-filter'}</div>
    </main>
  ))
);

const mockNotFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  })
);

vi.mock('next/headers', () => ({
  cookies: vi.fn(() =>
    Promise.resolve({
      get: vi.fn(() => undefined),
    })
  ),
  headers: vi.fn(() =>
    Promise.resolve({
      get: vi.fn(() => 'ogabassey.com'),
    })
  ),
}));

vi.mock('next/navigation', () => ({
  notFound: mockNotFound,
}));

vi.mock('@/components/storefront/store-not-published', () => ({
  StoreNotPublished: ({ businessName }: { businessName: string }) => (
    <div>{businessName}</div>
  ),
}));

vi.mock('@/components/ui/skeletons', () => ({
  StorefrontPageSkeleton: () => <div>Loading...</div>,
}));

vi.mock('@/lib/cached-data', () => ({
  getRequestScopedMerchant: vi.fn(() => Promise.resolve(mockMerchant)),
}));

vi.mock('@/lib/sanitize-json-ld', () => ({
  safeJsonLdStringify: vi.fn(() => '{}'),
}));

vi.mock('@/lib/seo-utils', () => ({
  generateLocalBusinessSchema: vi.fn(() => ({ '@type': 'LocalBusiness' })),
  generateServiceSchema: vi.fn(() => ({ '@type': 'Service' })),
  generateWebSiteSchema: vi.fn(() => ({ '@type': 'WebSite' })),
}));

vi.mock('@/lib/validation', () => ({
  isValidMerchantIdentifier: vi.fn(() => true),
}));

vi.mock('./storefront-content', () => ({
  StorefrontContent: mockStorefrontContent,
}));

import StorefrontPage from './page';

function renderStorefrontPage(
  searchParams: Record<string, string | string[] | undefined>
) {
  return StorefrontPage({
    params: Promise.resolve({ slug: 'ogabassey' }),
    searchParams: Promise.resolve(searchParams),
  });
}

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('StorefrontPage', () => {
  it('passes a trimmed validated category filter to StorefrontContent', async () => {
    const result = await renderStorefrontPage({ category: '  Laptops  ' });

    render(result as ReactElement);

    expect(mockStorefrontContent).toHaveBeenCalled();
    expect(mockStorefrontContent.mock.lastCall?.[0]).toMatchObject({
      categoryFilter: 'Laptops',
    });
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByText('Laptops')).toBeInTheDocument();
  });

  it('drops an empty category filter before rendering StorefrontContent', async () => {
    const result = await renderStorefrontPage({ category: '   ' });

    render(result as ReactElement);

    expect(mockStorefrontContent.mock.lastCall?.[0]).toMatchObject({
      categoryFilter: undefined,
    });
    expect(screen.getByText('no-filter')).toBeInTheDocument();
  });

  it('drops an overlong category filter before rendering StorefrontContent', async () => {
    const result = await renderStorefrontPage({
      category: 'x'.repeat(101),
    });

    render(result as ReactElement);

    expect(mockStorefrontContent.mock.lastCall?.[0]).toMatchObject({
      categoryFilter: undefined,
    });
    expect(screen.getByText('no-filter')).toBeInTheDocument();
  });
});
