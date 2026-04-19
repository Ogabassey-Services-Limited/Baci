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

vi.mock('../storefront-content', () => ({
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
const { StorefrontPageContent } = await import('../storefront-page-content');

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

  it('emits OnlineStore, WebSite, and address-backed Store schemas on the homepage', async () => {
    vi.mocked(getRequestScopedMerchant).mockResolvedValue({
      ...baseMerchant,
      support_email: 'support@ogabassey.com',
      support_phone: '+2348000000000',
      trust_profile: {
        founded_year: 2018,
        return_policy: {
          summary: 'Returns accepted for 7 days.',
          window_days: 7,
          return_method: 'mail',
          return_fees: 'free',
        },
      },
    } as unknown as Awaited<ReturnType<typeof getRequestScopedMerchant>>);

    render(
      await StorefrontPageContent({
        params: Promise.resolve({ slug: 'ogabassey' }),
      })
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
      (item) => item['@type'] === 'OnlineStore'
    );
    const store = schema['@graph'].find((item) => item['@type'] === 'Store');
    const website = schema['@graph'].find(
      (item) => item['@type'] === 'WebSite'
    );

    expect(organization).toMatchObject({
      '@type': 'OnlineStore',
      url: 'https://ogabassey.com',
      foundingDate: '2018',
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer service',
        email: 'support@ogabassey.com',
        telephone: '+2348000000000',
        availableLanguage: 'English',
      },
      hasMerchantReturnPolicy: {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: 'NG',
        merchantReturnDays: 7,
        returnMethod: 'https://schema.org/ReturnByMail',
        returnFees: 'https://schema.org/FreeReturn',
      },
    });
    expect(organization).toMatchObject({
      sameAs: expect.arrayContaining([
        'https://facebook.com/ogabasseyyy',
        'https://instagram.com/ogabasseyy',
        'https://x.com/ogabasseyy',
        'https://youtube.com/@ogabassey',
      ]),
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
    expect(website).toMatchObject({
      '@type': 'WebSite',
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: 'https://ogabassey.com/search?q={search_term_string}',
        },
        'query-input': 'required name=search_term_string',
      },
    });
  });

  it('falls back to OnlineStore + WebSite when no business address is available', async () => {
    vi.mocked(getRequestScopedMerchant).mockResolvedValue({
      ...baseMerchant,
      business_address: '',
    } as unknown as Awaited<ReturnType<typeof getRequestScopedMerchant>>);

    render(
      await StorefrontPageContent({
        params: Promise.resolve({ slug: 'ogabassey' }),
      })
    );

    expect(screen.getByText('Ogabassey storefront')).toBeInTheDocument();

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
      schema['@graph'].some((item) => item['@type'] === 'OnlineStore')
    ).toBe(true);
    expect(schema['@graph'].some((item) => item['@type'] === 'WebSite')).toBe(
      true
    );
  });

  it('renders the storefront fallback while request headers are still pending', () => {
    vi.mocked(getRequestScopedMerchant).mockResolvedValue(
      baseMerchant as unknown as Awaited<
        ReturnType<typeof getRequestScopedMerchant>
      >
    );
    mockHeaders.mockReturnValue(
      new Promise(() => {
        // Intentionally never resolves to keep the local fallback visible.
      })
    );

    render(<StorefrontPage params={Promise.resolve({ slug: 'ogabassey' })} />);

    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  });
});
