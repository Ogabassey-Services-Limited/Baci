import { headers } from 'next/headers';
import { permanentRedirect } from 'next/navigation';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({
  headers: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  permanentRedirect: vi.fn(),
}));

const { default: LegacyBlogPage } = await import(
  '@/app/(storefront)/[slug]/(content)/pages/blog/page'
);

describe('legacy blog page redirect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects custom-domain traffic to the canonical /blog URL', async () => {
    vi.mocked(headers).mockResolvedValue(
      new Headers([['x-custom-domain', 'ogabassey.com']])
    );

    await LegacyBlogPage({
      params: Promise.resolve({ slug: 'ogabassey' }),
      searchParams: Promise.resolve({}),
    });

    expect(permanentRedirect).toHaveBeenCalledWith('/blog');
  });

  it('redirects non-custom-domain traffic to /:slug/blog', async () => {
    vi.mocked(headers).mockResolvedValue(new Headers());

    await LegacyBlogPage({
      params: Promise.resolve({ slug: 'ogabassey' }),
      searchParams: Promise.resolve({}),
    });

    expect(permanentRedirect).toHaveBeenCalledWith('/ogabassey/blog');
  });
});
