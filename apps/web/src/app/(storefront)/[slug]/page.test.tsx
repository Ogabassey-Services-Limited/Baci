import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getRequestScopedMerchant } from '@/lib/cached-data';

vi.mock('@/lib/cached-data', () => ({
  getRequestScopedMerchant: vi.fn(),
}));

vi.mock('@/lib/sanitize-json-ld', () => ({
  safeJsonLdStringify: (value: unknown) => JSON.stringify(value),
}));

vi.mock('@/components/storefront/store-not-published', () => ({
  StoreNotPublished: ({ businessName }: { businessName: string }) => (
    <div>{businessName} unpublished</div>
  ),
}));

vi.mock('@/components/ui/skeletons', () => ({
  StorefrontPageSkeleton: () => <div data-testid="skeleton">Loading...</div>,
}));

vi.mock('./storefront-content', () => ({
  StorefrontContent: ({
    merchant,
  }: {
    merchant: { business_name: string };
  }) => <div>{merchant.business_name} storefront</div>,
}));

vi.mock('@/lib/validation', () => ({
  isValidMerchantIdentifier: () => true,
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

const baseMerchant = {
  id: 'merchant-1',
  slug: 'ogabassey',
  custom_domain: 'ogabassey.com',
  business_name: 'Ogabassey',
  site_title: 'Ogabassey - Official Online Store',
  site_tagline: '',
  site_description: '',
  business_type: 'electronics',
  logo_url: 'https://cdn.example.com/logo.svg',
  phone: '+2348146978921',
  email: 'hello@ogabassey.com',
  social_media: {
    facebook: '@ogabasseyyy',
    instagram: '@ogabasseyy',
    twitter: '@ogabasseyy',
    youtube: '@ogabassey',
  },
  brand_colors: undefined,
  business_address: '2 Olaide Tomori St, Ikeja, Lagos',
  payout_currency: 'NGN',
  is_published: true,
  template_id: 'ogabassey',
  plan_tier: 'pro',
  premium_features: null,
  country: 'NG',
};

const { default: StorefrontPage } = await import('./page');

describe('Storefront homepage structured data', () => {
  beforeEach(() => {
    vi.mocked(getRequestScopedMerchant).mockReset();
    mockHeaders.mockReset();
    notFound.mockClear();
    mockHeaders.mockResolvedValue(
      new Headers([
        ['host', 'stale-host.example'],
        ['x-pathname', '/'],
      ])
    );
  });

  it('emits Organization, WebSite, and address-backed Store schemas on the homepage', async () => {
    vi.mocked(getRequestScopedMerchant).mockResolvedValue(
      baseMerchant as unknown as Awaited<
        ReturnType<typeof getRequestScopedMerchant>
      >
    );

    render(
      await StorefrontPage({ params: Promise.resolve({ slug: 'ogabassey' }) })
    );

    expect(screen.getByText('Ogabassey storefront')).toBeInTheDocument();

    const schemaScript = document.querySelector(
      'script[type="application/ld+json"]'
    );
    expect(schemaScript).not.toBeNull();

    const schema = JSON.parse(schemaScript?.textContent || '{}') as {
      '@graph': Record<string, unknown>[];
    };
    const organization = schema['@graph'].find(
      (item) => item['@type'] === 'Organization'
    );
    const store = schema['@graph'].find((item) => item['@type'] === 'Store');
    const website = schema['@graph'].find(
      (item) => item['@type'] === 'WebSite'
    );

    expect(organization).toMatchObject({
      '@type': 'Organization',
      url: 'https://ogabassey.com',
    });
    expect(store).toMatchObject({
      '@type': 'Store',
      url: 'https://ogabassey.com',
      address: {
        '@type': 'PostalAddress',
        streetAddress: '2 Olaide Tomori St, Ikeja, Lagos',
        addressCountry: 'NG',
      },
    });
    expect(website).toMatchObject({
      '@type': 'WebSite',
      url: 'https://ogabassey.com',
      name: 'Ogabassey',
    });
    expect(website).not.toHaveProperty('potentialAction');
  });

  it('falls back to Organization + WebSite when no business address is available', async () => {
    vi.mocked(getRequestScopedMerchant).mockResolvedValue({
      ...baseMerchant,
      business_address: '',
    } as unknown as Awaited<ReturnType<typeof getRequestScopedMerchant>>);

    render(
      await StorefrontPage({ params: Promise.resolve({ slug: 'ogabassey' }) })
    );

    const schemaScript = document.querySelector(
      'script[type="application/ld+json"]'
    );
    expect(schemaScript).not.toBeNull();
    const schema = JSON.parse(schemaScript?.textContent || '{}') as {
      '@graph': Record<string, unknown>[];
    };

    expect(schema['@graph'].some((item) => item['@type'] === 'Store')).toBe(
      false
    );
    expect(
      schema['@graph'].some((item) => item['@type'] === 'Organization')
    ).toBe(true);
    expect(schema['@graph'].some((item) => item['@type'] === 'WebSite')).toBe(
      true
    );
  });
});
