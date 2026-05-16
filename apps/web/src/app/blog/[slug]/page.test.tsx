import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetPlatformBlogPost = vi.fn();
const mockNotFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});

vi.mock('@/lib/platform-blog', () => ({
  PLATFORM_BLOG_CONTEXT: {
    baseUrl: 'https://usebaci.com',
    businessName: 'Baci',
    logoUrl: 'https://usebaci.com/logo.png',
  },
  getPlatformBlogPost: (...args: unknown[]) => mockGetPlatformBlogPost(...args),
}));

vi.mock('next/navigation', () => ({
  notFound: () => mockNotFound(),
}));

vi.mock('@/components/app-body', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/platform/header', () => ({
  PlatformHeader: () => <header>Platform Header</header>,
}));

vi.mock('@/components/platform/footer', () => ({
  PlatformFooter: () => <footer>Platform Footer</footer>,
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('next/image', () => ({
  default: () => null,
}));

vi.mock('@/components/ui/safe-html', () => ({
  SafeHtml: ({ html }: { html: string }) => <div>{html}</div>,
}));

import BlogPostPage, { generateMetadata } from './page';

describe('platform blog post page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlatformBlogPost.mockResolvedValue({
      author_bio: 'Baci editorial desk',
      author_image_url: null,
      author_name: 'Baci Editorial',
      author_title: 'Editorial Team',
      category: 'Guides',
      content: '<p>Article body</p>',
      excerpt: 'Article excerpt',
      featured_image_alt: 'Launch image',
      featured_image_url: 'https://usebaci.com/media/platform/blog/launch.png',
      id: 'post-1',
      keywords: ['launch', 'guides'],
      published_at: '2026-05-16T10:00:00.000Z',
      reading_time_minutes: 5,
      seo_description: 'SEO description',
      seo_title: 'SEO title',
      slug: 'launch-faster',
      title: 'Launch Faster',
      updated_at: '2026-05-16T10:00:00.000Z',
      view_count: 3,
      word_count: 450,
    });
  });

  it('renders the platform post using the shared post query helper', async () => {
    const { container } = render(
      await BlogPostPage({
        params: Promise.resolve({ slug: 'launch-faster' }),
      })
    );

    expect(mockGetPlatformBlogPost).toHaveBeenCalledWith('launch-faster');
    expect(screen.getByText('Platform Header')).toBeInTheDocument();
    expect(screen.getByText('Platform Footer')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Launch Faster' })
    ).toBeInTheDocument();
    expect(screen.getByText('<p>Article body</p>')).toBeInTheDocument();

    const jsonLdScripts = container.querySelectorAll(
      'script[type="application/ld+json"]'
    );
    expect(jsonLdScripts).toHaveLength(2);
    expect(jsonLdScripts[0]?.textContent || '').toContain(
      '"@type":"BlogPosting"'
    );
    expect(jsonLdScripts[1]?.textContent || '').toContain(
      '"@type":"BreadcrumbList"'
    );
  });

  it('calls notFound when the post does not exist', async () => {
    mockGetPlatformBlogPost.mockResolvedValueOnce(null);

    await expect(
      BlogPostPage({
        params: Promise.resolve({ slug: 'missing-post' }),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(mockNotFound).toHaveBeenCalled();
  });

  it('builds canonical article metadata', async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'launch-faster' }),
    });

    expect(metadata.alternates?.canonical).toBe(
      'https://usebaci.com/blog/launch-faster'
    );
    expect((metadata.openGraph as { type?: string } | undefined)?.type).toBe(
      'article'
    );
    expect(metadata.robots).toEqual(
      expect.objectContaining({ 'max-image-preview': 'large' })
    );
  });
});
