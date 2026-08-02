import type { ResolvedMetadata, ResolvingMetadata } from 'next';
import { describe, expect, it, vi } from 'vitest';
import type { PageProps } from './product-page-types';

const mockGetRequestScopedProduct = vi.fn();

vi.mock('@/lib/cached-data', () => ({
  getCachedLegacyProductRedirectTarget: vi.fn(),
}));
vi.mock('./product-page-resolution', () => ({
  getRequestScopedProduct: (...args: unknown[]) =>
    mockGetRequestScopedProduct(...args),
  getCategorizedRedirectTarget: () => null,
  getInvalidVariantSelectionRedirectTarget: () => null,
  resolveProductPage: vi.fn(),
}));
vi.mock('@/lib/store-url', () => ({
  buildStoreUrl: () => 'https://zorvexa.usebaci.com',
}));
vi.mock('@/lib/seo-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/seo-utils')>();
  return {
    ...actual,
    getValidatedProductUrl: () =>
      'https://zorvexa.usebaci.com/fashion/linen-shirt',
  };
});

const { generateMetadata } = await import('./page');

const pageProps: PageProps = {
  params: Promise.resolve({ slug: 'zorvexa', productSlug: 'linen-shirt' }),
  searchParams: Promise.resolve({}),
};

const parentMetadata: ResolvedMetadata = {
  metadataBase: null,
  title: null,
  description: null,
  applicationName: null,
  authors: null,
  generator: null,
  keywords: null,
  referrer: null,
  themeColor: null,
  colorScheme: null,
  viewport: null,
  creator: null,
  publisher: null,
  robots: null,
  alternates: null,
  icons: null,
  openGraph: null,
  manifest: null,
  twitter: null,
  facebook: null,
  pinterest: null,
  verification: null,
  appleWebApp: null,
  formatDetection: null,
  itunes: null,
  abstract: null,
  appLinks: null,
  archives: null,
  assets: null,
  bookmarks: null,
  pagination: { previous: null, next: null },
  category: null,
  classification: null,
  other: null,
};

const resolvingMetadata: ResolvingMetadata = Promise.resolve(parentMetadata);

describe('generic PDP metadata SEO indexing', () => {
  it('uses resolved product publication/status/name facts in emitted robots', async () => {
    mockGetRequestScopedProduct.mockResolvedValue({
      merchant: {
        slug: 'zorvexa',
        business_name: 'Zorvexa',
        is_published: false,
        country: 'NG',
        payout_currency: 'NGN',
        social_media: null,
      },
      product: {
        id: 'product-1',
        name: 'Linen Shirt',
        slug: 'linen-shirt',
        status: 'active',
        description: 'A linen shirt.',
        meta_description: null,
        meta_title: null,
        category: 'Fashion',
        categories: { name: 'Fashion', slug: 'fashion' },
        price: 12_000,
        images: ['https://cdn.example.com/linen.jpg'],
        keywords: [],
      },
    });

    const metadata = await generateMetadata(pageProps, resolvingMetadata);

    expect(metadata.robots).toMatchObject({
      index: false,
      follow: true,
      googleBot: { index: false, follow: true },
    });
  });
});
