import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getRequestScopedMerchant } from '@/lib/cached-data';

vi.mock('@/lib/cached-data', () => ({
  getRequestScopedMerchant: vi.fn(),
}));

vi.mock('@/lib/validation', () => ({
  isValidMerchantIdentifier: () => true,
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
  social_media: {},
  country: 'NG',
};

const { generateMetadata } = await import('./page');

describe('storefront homepage metadata', () => {
  beforeEach(() => {
    vi.mocked(getRequestScopedMerchant).mockReset();
  });

  it('emits self-referencing canonical and hreflang alternates', async () => {
    vi.mocked(getRequestScopedMerchant).mockResolvedValue(
      baseMerchant as unknown as Awaited<
        ReturnType<typeof getRequestScopedMerchant>
      >
    );

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'ogabassey' }),
    });

    expect(metadata.alternates).toEqual({
      canonical: 'https://ogabassey.com',
      languages: {
        'en-NG': 'https://ogabassey.com',
        'x-default': 'https://ogabassey.com',
      },
    });
  });

  it('omits Nigerian hreflang for storefronts outside Nigeria', async () => {
    vi.mocked(getRequestScopedMerchant).mockResolvedValue({
      ...baseMerchant,
      slug: 'ghana-store',
      custom_domain: 'ghana.example.com',
      country: 'GH',
    } as unknown as Awaited<ReturnType<typeof getRequestScopedMerchant>>);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'ghana-store' }),
    });

    expect(metadata.alternates).toEqual({
      canonical: 'https://ghana.example.com',
      languages: {
        'x-default': 'https://ghana.example.com',
      },
    });
  });
});
