import { headers } from 'next/headers';
import { describe, expect, it, vi } from 'vitest';
import { getMerchantByIdentifier } from '@/lib/cached-data';
import { buildRequestScopedStoreUrl } from '@/lib/store-url';

vi.mock('@/lib/cached-data', () => ({
  getMerchantByIdentifier: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(),
}));

vi.mock('@/lib/sanitize-json-ld', () => ({
  safeJsonLdStringify: vi.fn(() => '{}'),
}));

vi.mock('@/lib/store-url', () => ({
  buildRequestScopedStoreUrl: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('@/templates/registry', () => ({
  getTemplate: vi.fn(() => null),
}));

vi.mock('../pages/terms/terms-page-client', () => ({
  TermsPageClient: vi.fn(() => null),
}));

const { generateMetadata } = await import('./page');

describe('terms-of-service metadata', () => {
  it('uses the request-scoped store URL for canonical metadata', async () => {
    vi.mocked(headers).mockResolvedValue(
      new Headers([['x-custom-domain', 'mystore.com']])
    );
    vi.mocked(buildRequestScopedStoreUrl).mockReturnValue(
      'https://mystore.com'
    );
    vi.mocked(getMerchantByIdentifier).mockResolvedValue({
      business_name: 'Test Store',
      logo_url: null,
      slug: 'test-store',
      custom_domain: null,
    } as unknown as Awaited<ReturnType<typeof getMerchantByIdentifier>>);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'test-store' }),
    });

    expect(metadata.alternates?.canonical).toBe(
      'https://mystore.com/terms-of-service'
    );
    expect(metadata.openGraph?.url).toBe(
      'https://mystore.com/terms-of-service'
    );
    expect(buildRequestScopedStoreUrl).toHaveBeenCalled();
  });

  it('returns fallback title when merchant is missing', async () => {
    vi.mocked(getMerchantByIdentifier).mockResolvedValue(null);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'unknown' }),
    });

    expect(metadata.title).toBe('Terms of Service');
  });
});
