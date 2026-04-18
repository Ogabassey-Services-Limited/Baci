import { render, screen } from '@testing-library/react';
import { headers } from 'next/headers';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getMerchantByIdentifier,
  getRequestScopedMerchant,
} from '@/lib/cached-data';

vi.mock('@/lib/cached-data', () => ({
  getMerchantByIdentifier: vi.fn(),
  getRequestScopedMerchant: vi.fn(),
}));

vi.mock('@/lib/merchant-template-data', () => ({
  toTemplateMerchantData: vi.fn((m: unknown) => m),
}));

vi.mock('@/lib/sanitize-json-ld', () => ({
  safeJsonLdStringify: vi.fn(() => '{}'),
}));

vi.mock('@/lib/seo-utils', () => ({
  generateFAQSchema: vi.fn(() => ({})),
  getIndexableRobotsMetadata: vi.fn(() => ({
    index: true,
    follow: true,
  })),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(),
}));

vi.mock('@/templates/registry', () => ({
  getTemplate: vi.fn(() => null),
}));

vi.mock('@/types/faq', () => ({
  parseLegacyFAQ: vi.fn(() => []),
}));

const { parseLegacyFAQ } = await import('@/types/faq');

vi.mock('../pages/faq/faq-page-client', () => ({
  FAQPageClient: () => <div data-testid="faq-client">FAQ UI</div>,
}));

const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});

vi.mock('next/navigation', () => ({
  notFound: () => notFound(),
}));

const { default: FAQPage, generateMetadata } = await import('./page');

describe('FAQPage', () => {
  beforeEach(() => {
    vi.mocked(getMerchantByIdentifier).mockReset();
    vi.mocked(getRequestScopedMerchant).mockReset();
    notFound.mockClear();
  });

  it('does not emit a duplicate wrapper h1 while content is suspended', () => {
    vi.mocked(getRequestScopedMerchant).mockReturnValue(
      new Promise<null>(() => {
        /* deferred: keep Suspense pending */
      })
    );

    render(<FAQPage params={Promise.resolve({ slug: 'test-store' })} />);

    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });

  it('renders Suspense fallback while content is loading', () => {
    vi.mocked(getRequestScopedMerchant).mockReturnValue(
      new Promise<null>(() => {
        /* deferred: keep Suspense pending */
      })
    );

    render(<FAQPage params={Promise.resolve({ slug: 'test-store' })} />);

    expect(screen.getByText('Loading FAQ...')).toBeInTheDocument();
  });

  it('does not call notFound when merchant has FAQ items', async () => {
    vi.mocked(getRequestScopedMerchant).mockResolvedValue({
      business_name: 'Test Store',
      faq_items: [{ question: 'Q?', answer: 'A.' }],
      pages: {},
      logo_url: null,
      slug: 'test-store',
    } as unknown as Awaited<ReturnType<typeof getRequestScopedMerchant>>);

    render(<FAQPage params={Promise.resolve({ slug: 'test-store' })} />);

    // Async RSC content streams via Suspense which jsdom can't resolve,
    // so verify the correct code path via function call assertions
    await vi.waitFor(() => {
      expect(getRequestScopedMerchant).toHaveBeenCalledWith('test-store');
    });
    expect(notFound).not.toHaveBeenCalled();
  });

  it('calls notFound when merchant resolves to null', async () => {
    vi.mocked(getRequestScopedMerchant).mockResolvedValue(null);

    render(<FAQPage params={Promise.resolve({ slug: 'missing' })} />);

    await vi.waitFor(() => {
      expect(notFound).toHaveBeenCalled();
    });
  });
});

describe('generateMetadata', () => {
  beforeEach(() => {
    vi.mocked(getMerchantByIdentifier).mockReset();
    vi.mocked(headers).mockResolvedValue(new Headers());
    notFound.mockClear();
  });

  it('calls notFound when merchant is missing', async () => {
    vi.mocked(getMerchantByIdentifier).mockResolvedValue(null);

    await expect(
      generateMetadata({ params: Promise.resolve({ slug: 'missing' }) })
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('calls notFound when no FAQ items exist', async () => {
    vi.mocked(getMerchantByIdentifier).mockResolvedValue({
      business_name: 'Test Store',
      faq_items: [],
      pages: {},
    } as unknown as Awaited<ReturnType<typeof getMerchantByIdentifier>>);

    await expect(
      generateMetadata({ params: Promise.resolve({ slug: 'test' }) })
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('calls notFound when faq_items is empty and legacy FAQ is unparsable', async () => {
    // Regression: truthy merchant.pages.faq that parseLegacyFAQ returns [] for
    vi.mocked(parseLegacyFAQ).mockReturnValue([]);
    vi.mocked(getMerchantByIdentifier).mockResolvedValue({
      business_name: 'Test Store',
      faq_items: [],
      pages: { faq: 'some unparsable content' },
    } as unknown as Awaited<ReturnType<typeof getMerchantByIdentifier>>);

    await expect(
      generateMetadata({ params: Promise.resolve({ slug: 'test' }) })
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('returns metadata when FAQ items exist', async () => {
    vi.mocked(headers).mockResolvedValue(
      new Headers([['x-custom-domain', 'ogabassey.com']])
    );
    vi.mocked(getMerchantByIdentifier).mockResolvedValue({
      business_name: 'Test Store',
      faq_items: [{ question: 'Q?', answer: 'A.' }],
      pages: {},
      logo_url: null,
      slug: 'test-store',
      custom_domain: 'ogabassey.com',
    } as unknown as Awaited<ReturnType<typeof getMerchantByIdentifier>>);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'test' }),
    });

    expect(metadata.title).toBe('FAQ | Test Store');
    expect(metadata.alternates?.canonical).toBe('https://ogabassey.com/faq');
    expect(metadata.openGraph?.url).toBe('https://ogabassey.com/faq');
  });
});
