import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSingle = vi.fn();
const mockNot = vi.fn();
const mockNotFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            not: (...args: unknown[]) => {
              mockNot(...args);
              return {
                eq: () => ({
                  single: (...singleArgs: unknown[]) =>
                    mockSingle(...singleArgs),
                }),
              };
            },
            eq: () => ({
              single: (...args: unknown[]) => mockSingle(...args),
            }),
          }),
        }),
      }),
    }),
  })),
}));

vi.mock('lucide-react', () => ({
  ArrowLeft: () => null,
  Calendar: () => null,
  Clock: () => null,
  Eye: () => null,
}));

vi.mock('next/image', () => ({
  default: () => null,
}));

vi.mock('next/link', () => ({
  default: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('next/navigation', () => ({
  notFound: () => mockNotFound(),
}));

vi.mock('@/components/app-body', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/platform/footer', () => ({
  PlatformFooter: () => null,
}));

vi.mock('@/components/platform/header', () => ({
  PlatformHeader: () => null,
}));

vi.mock('@/components/ui/safe-html', () => ({
  SafeHtml: () => null,
}));

vi.mock('@/lib/routes', () => ({
  asRoute: (value: string) => value,
}));

import BlogPostPage, { generateMetadata } from './page';

describe('platform blog post page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the local page fallback while the post query is pending', () => {
    mockSingle.mockReturnValue(
      new Promise(() => {
        // Keep the page content pending so the Suspense fallback renders.
      })
    );

    render(
      <BlogPostPage
        params={Promise.resolve({
          slug: 'test-post',
        })}
      />
    );

    expect(screen.getByText('Loading article…')).toBeInTheDocument();
  });

  it('excludes platform post metadata lookups without a published_at timestamp', async () => {
    mockSingle.mockResolvedValue({
      data: {
        id: 'post-1',
        title: 'Discover Ready Post',
        slug: 'discover-ready-post',
        content: '<p>Post body</p>',
        excerpt:
          'A practical Discover-ready post with enough description for metadata generation.',
        featured_image_url: null,
        featured_image_alt: null,
        category: 'Guides',
        tags: [],
        keywords: [],
        author_name: 'Baci',
        author_title: null,
        author_image_url: null,
        author_bio: null,
        reading_time_minutes: 4,
        published_at: '2026-05-01T00:00:00Z',
        view_count: 10,
        seo_title: null,
        seo_description: null,
      },
      error: null,
    });

    await generateMetadata({
      params: Promise.resolve({ slug: 'discover-ready-post' }),
    });

    expect(mockNot).toHaveBeenCalledWith('published_at', 'is', null);
  });
});
