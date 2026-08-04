import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getRequestScopedMerchant } from '@/lib/cached-data';

vi.mock('@/lib/cached-data', () => ({ getRequestScopedMerchant: vi.fn() }));
vi.mock('@/lib/store-url', () => ({
  buildStoreUrl: () => 'https://zorvexa.usebaci.com',
}));
vi.mock('@/lib/validation', () => ({ isValidMerchantIdentifier: () => true }));

const { generateMetadata } = await import('./page');

const merchant = {
  business_name: 'Zorvexa',
  slug: 'zorvexa',
  site_title: null,
  site_description: null,
  site_tagline: null,
  country: 'NG',
  logo_url: null,
  social_media: null,
};

describe('homepage SEO indexing', () => {
  beforeEach(() => vi.mocked(getRequestScopedMerchant).mockReset());

  it('emits noindex,follow for an unpublished merchant', async () => {
    vi.mocked(getRequestScopedMerchant).mockResolvedValue({
      ...merchant,
      is_published: false,
    } as never);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'zorvexa' }),
    });

    expect(metadata.robots).toEqual({ index: false, follow: true });
  });

  it('emits noindex,follow for the static OgaBassey home when unpublished', async () => {
    vi.mocked(getRequestScopedMerchant).mockResolvedValue({
      ...merchant,
      business_name: 'OgaBassey',
      is_published: false,
      slug: 'ogabassey',
    } as never);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'ogabassey' }),
    });

    expect(metadata.robots).toEqual({ index: false, follow: true });
  });

  it('keeps a published merchant indexable without catalog prerequisites', async () => {
    vi.mocked(getRequestScopedMerchant).mockResolvedValue({
      ...merchant,
      is_published: true,
    } as never);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'zorvexa' }),
    });

    expect(metadata.robots).toEqual({ index: true, follow: true });
  });

  it('does not use a slug as a substitute for a missing merchant name', async () => {
    vi.mocked(getRequestScopedMerchant).mockResolvedValue({
      ...merchant,
      business_name: ' ',
      is_published: true,
    } as never);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'zorvexa' }),
    });

    expect(metadata.robots).toEqual({ index: false, follow: true });
  });

  it('emits an authored title unchanged while neutral fallback copy remains factual', async () => {
    vi.mocked(getRequestScopedMerchant).mockResolvedValue({
      ...merchant,
      is_published: true,
      site_title: 'Zorvexa | Buy Gadgets Pay Later',
    } as never);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'zorvexa' }),
    });

    expect(metadata.openGraph?.title).toBe('Zorvexa | Buy Gadgets Pay Later');
    expect(metadata.description).toBe('Zorvexa storefront in NG.');
  });

  it.each([
    null,
    '   ',
  ])('uses only neutral merchant facts when site_title is %p', async (siteTitle) => {
    vi.mocked(getRequestScopedMerchant).mockResolvedValue({
      ...merchant,
      is_published: true,
      site_title: siteTitle,
    } as never);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'zorvexa' }),
    });

    expect(metadata.openGraph?.title).toBe('Zorvexa - Official Online Store');
    expect(metadata.openGraph?.title).not.toMatch(
      /pay later|premium|fresh food|secure checkout/i
    );
  });
});
