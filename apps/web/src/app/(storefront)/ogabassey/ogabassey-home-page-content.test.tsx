import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDynamicContentShouldSuspend, mockHeaders, mockPublishedMerchant } =
  vi.hoisted(() => ({
    mockHeaders: vi.fn(() => Promise.resolve(new Headers())),
    mockDynamicContentShouldSuspend: vi.fn(() => false),
    mockPublishedMerchant: {
      id: 'merchant-1',
      business_name: 'OgaBassey',
      business_type: 'electronics',
      email: 'hello@ogabassey.com',
      phone: '+2341234567',
      logo_url: '',
      brand_colors: undefined,
      country: 'NG',
      pages: undefined,
      slug: 'ogabassey',
      custom_domain: 'ogabassey.com',
      favicon_svg_url: undefined,
      favicon_png_32_url: undefined,
      favicon_apple_touch_url: undefined,
      social_media: undefined,
      business_address: '',
      is_published: true,
      feature_settings: undefined,
      template_id: 'ogabassey',
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
    },
  }));

vi.mock('@/lib/cached-data', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getRequestScopedMerchant: vi.fn(() =>
      Promise.resolve(mockPublishedMerchant)
    ),
  };
});

vi.mock('next/headers', () => ({
  headers: () => mockHeaders(),
}));

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('not-found');
  }),
}));

vi.mock('next/server', () => ({
  connection: vi.fn(() => Promise.resolve()),
}));

vi.mock('./ogabassey-home-hero-section', () => ({
  OgabasseyHomeHeroSection: ({ pathPrefix }: { pathPrefix: string }) => (
    <section aria-label="Product hero" data-prefix={pathPrefix} />
  ),
}));

vi.mock('./ogabassey-home-dynamic-content', () => ({
  OgabasseyHomeDynamicContent: ({ pathPrefix }: { pathPrefix: string }) => {
    if (mockDynamicContentShouldSuspend()) {
      throw new Promise(() => undefined);
    }
    return <section aria-label="Dynamic home content">{pathPrefix}</section>;
  },
}));

vi.mock('@/components/storefront/store-not-published', () => ({
  StoreNotPublished: ({ businessName }: { businessName: string }) => (
    <div data-testid="store-not-published">{businessName}</div>
  ),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    prefetch: _prefetch,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    prefetch?: boolean;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { notFound } from 'next/navigation';
import { getRequestScopedMerchant } from '@/lib/cached-data';
import { OgabasseyHomePageContent } from './ogabassey-home-page-content';

describe('OgabasseyHomePageContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHeaders.mockResolvedValue(new Headers());
    mockDynamicContentShouldSuspend.mockReturnValue(false);
    vi.mocked(getRequestScopedMerchant).mockResolvedValue(
      mockPublishedMerchant
    );
  });

  it('renders the final hero and dynamic home content with the path-mode prefix after the publication guard', async () => {
    const result = await OgabasseyHomePageContent({ pathPrefix: '/ogabassey' });

    render(result as ReactElement);

    expect(
      screen.getByRole('region', { name: /product hero/i })
    ).toHaveAttribute('data-prefix', '/ogabassey');
    expect(
      screen.getByRole('region', { name: /dynamic home content/i })
    ).toHaveTextContent('/ogabassey');
    expect(getRequestScopedMerchant).toHaveBeenCalledWith('ogabassey');
  });

  it('keeps the final hero visible when below-fold dynamic content suspends', async () => {
    mockDynamicContentShouldSuspend.mockReturnValue(true);

    const result = await OgabasseyHomePageContent({ pathPrefix: '/ogabassey' });

    render(result as ReactElement);

    expect(
      screen.getByRole('region', { name: /product hero/i })
    ).toHaveAttribute('data-prefix', '/ogabassey');
    expect(
      screen.queryByRole('region', { name: /dynamic home content/i })
    ).not.toBeInTheDocument();
  });

  it('resolves the homepage merchant from custom-domain request context', async () => {
    mockHeaders.mockResolvedValue(
      new Headers([['x-custom-domain', 'ogabassey.com']])
    );

    const result = await OgabasseyHomePageContent({ pathPrefix: '' });

    render(result as ReactElement);

    expect(getRequestScopedMerchant).toHaveBeenCalledWith('ogabassey.com');
    expect(
      screen.getByRole('region', { name: /product hero/i })
    ).toHaveAttribute('data-prefix', '');
    expect(
      screen.getByRole('region', { name: /dynamic home content/i })
    ).toBeEmptyDOMElement();
  });

  it('keeps subdomain rewrite links root-relative from the merchant header', async () => {
    mockHeaders.mockResolvedValue(
      new Headers([['x-merchant-slug', 'ogabassey']])
    );

    const result = await OgabasseyHomePageContent({ pathPrefix: '/ogabassey' });

    render(result as ReactElement);

    expect(getRequestScopedMerchant).toHaveBeenCalledWith('ogabassey');
    expect(
      screen.getByRole('region', { name: /product hero/i })
    ).toHaveAttribute('data-prefix', '');
    expect(
      screen.getByRole('region', { name: /dynamic home content/i })
    ).toBeEmptyDOMElement();
  });

  it('falls back to the OgaBassey slug when only a deployment host is present', async () => {
    mockHeaders.mockResolvedValue(
      new Headers([['host', 'baci-preview.vercel.app']])
    );

    await OgabasseyHomePageContent({ pathPrefix: '/ogabassey' });

    expect(getRequestScopedMerchant).toHaveBeenCalledWith('ogabassey');
  });

  it('shows the unpublished storefront state when production store is disabled', async () => {
    vi.mocked(getRequestScopedMerchant).mockResolvedValueOnce({
      ...mockPublishedMerchant,
      is_published: false,
    });

    const result = await OgabasseyHomePageContent({ pathPrefix: '/ogabassey' });

    render(result as ReactElement);

    expect(screen.getByTestId('store-not-published')).toHaveTextContent(
      'OgaBassey'
    );
    expect(
      screen.queryByRole('region', { name: /dynamic home content/i })
    ).not.toBeInTheDocument();
  });

  it('returns 404 when merchant lookup is null', async () => {
    vi.mocked(getRequestScopedMerchant).mockResolvedValueOnce(null);

    await expect(
      OgabasseyHomePageContent({ pathPrefix: '/ogabassey' })
    ).rejects.toThrow('not-found');

    expect(notFound).toHaveBeenCalledOnce();
  });
});
