import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockHeaders, mockPublishedMerchant } = vi.hoisted(() => ({
  mockHeaders: vi.fn(() => Promise.resolve(new Headers())),
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

vi.mock('@/components/storefront/ogabassey/components/Hero', () => ({
  Hero: () => <section aria-label="OgaBassey hero">Hero shell</section>,
}));

vi.mock('./ogabassey-home-dynamic-content', () => ({
  OgabasseyHomeDynamicContent: ({ pathPrefix }: { pathPrefix: string }) => (
    <div data-testid="dynamic-content">{pathPrefix}</div>
  ),
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
    vi.mocked(getRequestScopedMerchant).mockResolvedValue(
      mockPublishedMerchant
    );
  });

  it('renders the hero after the publication guard and streams dynamic content separately', async () => {
    const result = await OgabasseyHomePageContent();

    render(result as ReactElement);

    expect(
      screen.getByRole('region', { name: 'OgaBassey hero' })
    ).toBeInTheDocument();
    expect(screen.getByTestId('dynamic-content')).toHaveTextContent(
      '/ogabassey'
    );
    expect(getRequestScopedMerchant).toHaveBeenCalledWith('ogabassey');
  });

  it('can omit the hero when another route shell renders it before dynamic content', async () => {
    const result = await OgabasseyHomePageContent({ renderHero: false });

    render(result as ReactElement);

    expect(
      screen.queryByRole('region', { name: 'OgaBassey hero' })
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('dynamic-content')).toHaveTextContent(
      '/ogabassey'
    );
  });

  it('resolves the homepage merchant from custom-domain request context', async () => {
    mockHeaders.mockResolvedValue(
      new Headers([['x-custom-domain', 'ogabassey.com']])
    );

    const result = await OgabasseyHomePageContent();

    render(result as ReactElement);

    expect(getRequestScopedMerchant).toHaveBeenCalledWith('ogabassey.com');
    expect(screen.getByTestId('dynamic-content')).toBeEmptyDOMElement();
  });

  it('falls back to the OgaBassey slug when only a deployment host is present', async () => {
    mockHeaders.mockResolvedValue(
      new Headers([['host', 'baci-preview.vercel.app']])
    );

    await OgabasseyHomePageContent();

    expect(getRequestScopedMerchant).toHaveBeenCalledWith('ogabassey');
  });

  it('shows the unpublished storefront state when production store is disabled', async () => {
    vi.mocked(getRequestScopedMerchant).mockResolvedValueOnce({
      ...mockPublishedMerchant,
      is_published: false,
    });

    const result = await OgabasseyHomePageContent();

    render(result as ReactElement);

    expect(screen.getByTestId('store-not-published')).toHaveTextContent(
      'OgaBassey'
    );
    expect(
      screen.queryByRole('region', { name: 'OgaBassey hero' })
    ).not.toBeInTheDocument();
  });

  it('returns 404 when merchant lookup is null', async () => {
    vi.mocked(getRequestScopedMerchant).mockResolvedValueOnce(null);

    await expect(OgabasseyHomePageContent()).rejects.toThrow('not-found');

    expect(notFound).toHaveBeenCalledOnce();
  });
});
