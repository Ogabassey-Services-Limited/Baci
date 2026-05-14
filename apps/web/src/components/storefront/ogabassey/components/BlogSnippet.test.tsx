import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockNot = vi.fn();
const mockLimit = vi.fn();
const mockProductMaybeSingle = vi.fn();
const mockRpc = vi.fn();
const EXPECTED_FALLBACK_FILTER_CALLS = 2;
const blogQuery = {
  eq: vi.fn(() => blogQuery),
  ilike: vi.fn(() => blogQuery),
  limit: mockLimit,
  not: mockNot,
  order: vi.fn(() => blogQuery),
  select: vi.fn(() => blogQuery),
};
const productQuery = {
  eq: vi.fn(() => productQuery),
  maybeSingle: mockProductMaybeSingle,
  select: vi.fn(() => productQuery),
};

mockNot.mockReturnValue(blogQuery);
mockLimit.mockResolvedValue({ data: [], error: null });

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchantSafe: () => ({ basePath: '/ogabassey' }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    rpc: mockRpc,
    from: (table: string) => {
      if (table === 'blog_posts') {
        return blogQuery;
      }
      if (table === 'products') {
        return productQuery;
      }
      throw new Error(`Unexpected table ${table}`);
    },
  })),
}));

vi.mock('next/image', () => ({
  default: () => null,
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
  }: {
    children: ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

import { BlogSnippet } from '@/components/storefront/ogabassey/components/BlogSnippet';

describe('BlogSnippet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNot.mockReturnValue(blogQuery);
    mockLimit.mockResolvedValue({ data: [], error: null });
    mockProductMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockRpc.mockResolvedValue({ data: [], error: null });
  });

  it('excludes fallback blog posts without a published_at timestamp and renders no snippet when none exists', async () => {
    render(
      <BlogSnippet
        category="Smartphones"
        merchantId="merchant-1"
      />
    );

    await waitFor(() =>
      expect(mockLimit).toHaveBeenCalledTimes(EXPECTED_FALLBACK_FILTER_CALLS)
    );

    expect(mockNot).toHaveBeenCalledWith('published_at', 'is', null);
    expect(mockNot).toHaveBeenCalledTimes(EXPECTED_FALLBACK_FILTER_CALLS);
    expect(
      screen.queryByRole('heading', { name: /from the blog/i })
    ).not.toBeInTheDocument();
  });

  it('renders no snippet when the category blog query fails', async () => {
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockLimit
      .mockResolvedValueOnce({ data: [], error: new Error('query failed') })
      .mockResolvedValueOnce({ data: [], error: null });

    try {
      render(<BlogSnippet category="Smartphones" merchantId="merchant-1" />);

      await waitFor(() =>
        expect(mockLimit).toHaveBeenCalledTimes(EXPECTED_FALLBACK_FILTER_CALLS)
      );

      expect(mockNot).toHaveBeenCalledWith('published_at', 'is', null);
      expect(mockNot).toHaveBeenCalledTimes(EXPECTED_FALLBACK_FILTER_CALLS);
      expect(
        screen.queryByRole('heading', { name: /from the blog/i })
      ).not.toBeInTheDocument();
      expect(errorSpy).toHaveBeenCalledWith(
        'Error fetching category blog snippet:',
        expect.any(Error)
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('falls back without logging an error when the product embedding row is missing', async () => {
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockProductMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    try {
      render(
        <BlogSnippet
          category="Smartphones"
          merchantId="merchant-1"
          productId="missing-product"
        />
      );

      await waitFor(() =>
        expect(mockLimit).toHaveBeenCalledTimes(EXPECTED_FALLBACK_FILTER_CALLS)
      );

      expect(mockProductMaybeSingle).toHaveBeenCalled();
      expect(mockRpc).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalledWith(
        'Error fetching product embedding for blog snippet:',
        expect.anything()
      );
      expect(
        screen.queryByRole('heading', { name: /from the blog/i })
      ).not.toBeInTheDocument();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('renders the related blog snippet when a published post is found', async () => {
    mockLimit.mockResolvedValueOnce({
      data: [
        {
          id: 'post-1',
          title: 'Best Smartphones in 2026',
          slug: 'best-smartphones-2026',
          excerpt: 'Top picks for this year.',
          featured_image_url:
            'https://cdn.example.com/storage/v1/object/public/media/merchant-1/blog/cover.png',
          category: 'Smartphones',
          reading_time_minutes: 5,
        },
      ],
      error: null,
    });

    render(
      <BlogSnippet
        category="Smartphones"
        merchantId="merchant-1"
      />
    );

    await screen.findByRole('heading', { name: /from the blog/i });
    expect(
      screen.getByRole('heading', { name: /best smartphones in 2026/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /read full article/i })
    ).toHaveAttribute('href', '/ogabassey/blog/best-smartphones-2026');
  });
});
