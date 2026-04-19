import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMerchantByIdentifier } from '@/lib/cached-data';
import { buildStoreUrl } from '@/lib/store-url';

const mockBuildMerchantTrustProfile = vi.fn();

vi.mock('@/lib/cached-data', () => ({
  getMerchantByIdentifier: vi.fn(),
}));

vi.mock('@/lib/sanitize-json-ld', () => ({
  safeJsonLdStringify: vi.fn((value: unknown) => JSON.stringify(value)),
}));

vi.mock('@/lib/store-url', () => ({
  buildStoreUrl: vi.fn(),
}));

vi.mock('@/lib/storefront-trust/build-merchant-trust-profile', () => ({
  buildMerchantTrustProfile: (...args: unknown[]) =>
    mockBuildMerchantTrustProfile(...args),
}));

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('@/templates/registry', () => ({
  getTemplate: vi.fn(() => null),
}));

vi.mock('./about-page-client', () => ({
  AboutPageClient: vi.fn(() => null),
}));

const { AboutJsonLd, generateMetadata } = await import('./page');

describe('pages/about metadata', () => {
  beforeEach(() => {
    mockBuildMerchantTrustProfile.mockReset();
  });

  it('uses the merchant custom domain for canonical and Open Graph URLs', async () => {
    vi.mocked(buildStoreUrl).mockReturnValue('https://ogabassey.com');
    vi.mocked(getMerchantByIdentifier).mockResolvedValue({
      business_name: 'Test Store',
      about_page: { story: 'Our story' },
      logo_url: 'https://cdn.example.com/logo.png',
      slug: 'test-store',
      custom_domain: 'ogabassey.com',
    } as unknown as Awaited<ReturnType<typeof getMerchantByIdentifier>>);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'test-store' }),
    });

    expect(metadata.alternates?.canonical).toBe('https://ogabassey.com/about');
    expect(metadata.openGraph?.url).toBe('https://ogabassey.com/about');
  });

  it('falls back to the slug-based URL when no custom domain exists', async () => {
    vi.mocked(buildStoreUrl).mockReturnValue('https://test-store.usebaci.com');
    vi.mocked(getMerchantByIdentifier).mockResolvedValue({
      business_name: 'Test Store',
      about_page: { story: 'Our story' },
      logo_url: 'https://cdn.example.com/logo.png',
      slug: 'test-store',
      custom_domain: null,
    } as unknown as Awaited<ReturnType<typeof getMerchantByIdentifier>>);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'test-store' }),
    });

    expect(metadata.alternates?.canonical).toBe(
      'https://test-store.usebaci.com/about'
    );
    expect(metadata.openGraph?.url).toBe(
      'https://test-store.usebaci.com/about'
    );
  });

  it('threads the assembled trust profile into the about page JSON-LD builder', async () => {
    vi.mocked(buildStoreUrl).mockReturnValue('https://test-store.usebaci.com');
    vi.mocked(getMerchantByIdentifier).mockResolvedValue({
      business_name: 'Test Store',
      about_page: { story: 'Our story' },
      logo_url: 'https://cdn.example.com/logo.png',
      slug: 'test-store',
      custom_domain: null,
      country: 'NG',
    } as unknown as Awaited<ReturnType<typeof getMerchantByIdentifier>>);
    mockBuildMerchantTrustProfile.mockReturnValue({
      socialLinks: {},
      derivedLinks: {},
    });

    render(
      await AboutJsonLd({
        params: Promise.resolve({ slug: 'test-store' }),
      })
    );

    await waitFor(() =>
      expect(mockBuildMerchantTrustProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          business_name: 'Test Store',
        }),
        'https://test-store.usebaci.com'
      )
    );

    const schemaScripts = document.querySelectorAll(
      'script[type="application/ld+json"]'
    );
    const schemaScript = schemaScripts[schemaScripts.length - 1];
    expect(schemaScript).toBeDefined();
    const schema = JSON.parse(schemaScript?.textContent || '{}') as {
      url: string;
    };
    expect(schema.url).toBe('https://test-store.usebaci.com/about');
  });

  it('returns fallback title when merchant is missing', async () => {
    vi.mocked(getMerchantByIdentifier).mockResolvedValue(null);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'unknown' }),
    });

    expect(metadata.title).toBe('About Us');
  });

  it('throws notFound when the merchant has no about content at all', async () => {
    vi.mocked(buildStoreUrl).mockReturnValue('https://test-store.usebaci.com');
    vi.mocked(getMerchantByIdentifier).mockResolvedValue({
      business_name: 'Test Store',
      about_page: {},
      pages: {},
      logo_url: null,
      slug: 'test-store',
    } as unknown as Awaited<ReturnType<typeof getMerchantByIdentifier>>);

    await expect(
      generateMetadata({
        params: Promise.resolve({ slug: 'test-store' }),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('renders metadata when only structured (non-narrative) about content exists', async () => {
    vi.mocked(buildStoreUrl).mockReturnValue('https://test-store.usebaci.com');
    vi.mocked(getMerchantByIdentifier).mockResolvedValue({
      business_name: 'Test Store',
      about_page: {
        founder_name: 'Amina Bello',
        team: [{ name: 'Bola Ade', role: 'Operations Lead' }],
        milestones: [{ year: 2024, title: 'Launched' }],
        awards: [{ title: 'Best New Store' }],
        social_proof: { rating: 4.9, review_count: 31 },
        gallery: ['https://cdn.example.com/about.jpg'],
      },
      pages: {},
      logo_url: 'https://cdn.example.com/logo.png',
      slug: 'test-store',
      custom_domain: null,
    } as unknown as Awaited<ReturnType<typeof getMerchantByIdentifier>>);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'test-store' }),
    });

    expect(metadata.title).toBe('About Us | Test Store');
    expect(metadata.alternates?.canonical).toBe(
      'https://test-store.usebaci.com/about'
    );
    // No narrative story → falls back to the generic "Learn more about <store>" description.
    expect(metadata.description).toBe('Learn more about Test Store');
    expect(metadata.openGraph?.description).toBe('Learn more about Test Store');
  });
});
