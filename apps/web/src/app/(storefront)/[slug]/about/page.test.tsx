import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMerchantByIdentifier } from '@/lib/cached-data';

vi.mock('@/lib/cached-data', () => ({
  getMerchantByIdentifier: vi.fn(),
}));

vi.mock('@/lib/sanitize-json-ld', () => ({
  safeJsonLdStringify: vi.fn(() => '{}'),
}));

vi.mock('@/templates/registry', () => ({
  getTemplate: vi.fn(() => null),
}));

vi.mock('@/types/about-page', () => ({
  generateAboutPageJsonLd: vi.fn(() => ({})),
}));

vi.mock('../pages/about/about-page-client', () => ({
  AboutPageClient: () => <div data-testid="about-client">About UI</div>,
}));

const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});

vi.mock('next/navigation', () => ({
  notFound: () => notFound(),
}));

const { default: AboutPage, generateMetadata } = await import('./page');

describe('AboutPage', () => {
  beforeEach(() => {
    vi.mocked(getMerchantByIdentifier).mockReset();
    notFound.mockClear();
  });

  it('does not emit a duplicate wrapper h1 while content is suspended', () => {
    // Deferred promise keeps async components suspended
    vi.mocked(getMerchantByIdentifier).mockReturnValue(
      new Promise<null>(() => {
        /* deferred: keep Suspense pending */
      })
    );

    render(<AboutPage params={Promise.resolve({ slug: 'test-store' })} />);

    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });

  it('renders Suspense fallback while content is loading', () => {
    // Deferred promise — never resolves, so Suspense stays in fallback
    vi.mocked(getMerchantByIdentifier).mockReturnValue(
      new Promise<null>(() => {
        /* deferred: keep Suspense pending */
      })
    );

    render(<AboutPage params={Promise.resolve({ slug: 'test-store' })} />);

    expect(screen.getByText('Loading about page...')).toBeInTheDocument();
  });
});

describe('generateMetadata', () => {
  beforeEach(() => {
    vi.mocked(getMerchantByIdentifier).mockReset();
    notFound.mockClear();
  });

  it('calls notFound when merchant is missing', async () => {
    vi.mocked(getMerchantByIdentifier).mockResolvedValue(null);

    await expect(
      generateMetadata({ params: Promise.resolve({ slug: 'missing' }) })
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('calls notFound when about content is empty', async () => {
    vi.mocked(getMerchantByIdentifier).mockResolvedValue({
      business_name: 'Test Store',
      about_page: {},
      pages: {},
    } as unknown as Awaited<ReturnType<typeof getMerchantByIdentifier>>);

    await expect(
      generateMetadata({ params: Promise.resolve({ slug: 'test' }) })
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('returns metadata when about content exists', async () => {
    vi.mocked(getMerchantByIdentifier).mockResolvedValue({
      business_name: 'Test Store',
      about_page: { story: 'Our story' },
      pages: {},
      logo_url: null,
      slug: 'test-store',
      custom_domain: 'ogabassey.com',
    } as unknown as Awaited<ReturnType<typeof getMerchantByIdentifier>>);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'test' }),
    });

    expect(metadata.title).toBe('About Us | Test Store');
    expect(metadata.alternates?.canonical).toBe('https://ogabassey.com/about');
    expect(metadata.openGraph?.url).toBe('https://ogabassey.com/about');
  });
});
