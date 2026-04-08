import { describe, expect, it, vi } from 'vitest';
import { getMerchantByIdentifier } from '@/lib/cached-data';
import { buildStoreUrl } from '@/lib/store-url';

vi.mock('@/lib/cached-data', () => ({
  getMerchantByIdentifier: vi.fn(),
}));

vi.mock('@/lib/sanitize-json-ld', () => ({
  safeJsonLdStringify: vi.fn(() => '{}'),
}));

vi.mock('@/lib/store-url', () => ({
  buildStoreUrl: vi.fn(),
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

const { generateMetadata } = await import('./page');

describe('pages/about metadata', () => {
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

  it('returns fallback title when merchant is missing', async () => {
    vi.mocked(getMerchantByIdentifier).mockResolvedValue(null);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'unknown' }),
    });

    expect(metadata.title).toBe('About Us');
  });
});
