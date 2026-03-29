import { describe, expect, it, vi } from 'vitest';
import { getMerchantByIdentifier } from '@/lib/cached-data';

vi.mock('@/lib/cached-data', () => ({
  getMerchantByIdentifier: vi.fn(),
}));

vi.mock('@/lib/sanitize-json-ld', () => ({
  safeJsonLdStringify: vi.fn(() => '{}'),
}));

vi.mock('@/lib/store-url', () => ({
  buildStoreUrl: (merchant: { slug: string; custom_domain?: string | null }) =>
    merchant.custom_domain
      ? `https://${merchant.custom_domain}`
      : `https://${merchant.slug}.usebaci.com`,
}));

const { generateMetadata } = await import('./page');

describe('pages/about metadata', () => {
  it('uses the merchant custom domain for canonical and Open Graph URLs', async () => {
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
});
