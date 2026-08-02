import type { ReactNode } from 'react';
import { afterEach, beforeEach, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
    push: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
  })),
}));

vi.mock('next/image', () => ({
  default: ({
    alt,
    fill,
    src,
  }: {
    alt: string;
    fill?: boolean;
    src: string;
  }) => (
    <div
      data-alt={alt}
      data-fill={fill}
      data-src={src}
      data-testid="mock-image"
    />
  ),
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}));

vi.mock('@/hooks/use-merchant-features', () => ({
  useMerchantFeatures: vi.fn(() => ({
    autoBlogEnabled: false,
    blogEnabled: true,
    isLoading: false,
  })),
}));

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchant: vi.fn(() => ({ merchant: null })),
}));

vi.mock('@/hooks/use-debounce', () => ({
  useDebounce: vi.fn((value) => value),
}));

vi.mock('@/lib/routes', () => ({
  asRoute: vi.fn((url: string) => url),
}));

vi.mock('@/lib/validate-slug', () => ({
  isSafeSlug: vi.fn(() => true),
}));

vi.mock('./actions', () => ({
  getPreviewUrl: vi.fn(),
}));

vi.mock('@/lib/csrf', () => ({
  CSRF_HEADER_NAME: 'x-csrf-token',
  getClientCsrfToken: vi.fn(() => 'test-csrf-token'),
}));

import type { BlogPost } from './blog-client-page';

export const { useMerchantFeatures } = await import(
  '@/hooks/use-merchant-features'
);
export const { useMerchant } = await import('@/hooks/use-merchant-client');
const { useToast } = await import('@/hooks/use-toast');
export const { getPreviewUrl } = await import('./actions');
export const { BlogClientPage } = await import('./blog-client-page');

export const mockToast = vi.fn();
export const mockMerchant = {
  id: 'merchant-1',
  slug: 'test-merchant',
  custom_domain: null,
};

export const mockPosts: BlogPost[] = [
  {
    id: 'post-1',
    title: 'First Blog Post',
    slug: 'first-blog-post',
    excerpt: 'This is the first post',
    featured_image_url: 'https://example.com/image1.jpg',
    featured_image_width: null,
    featured_image_height: null,
    featured_image_variants: {},
    category: 'Technology',
    status: 'published',
    author_name: 'John Doe',
    view_count: 150,
    reading_time_minutes: 5,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-15T00:00:00Z',
    published_at: '2026-01-10T00:00:00Z',
  },
  {
    id: 'post-2',
    title: 'Draft Post',
    slug: 'draft-post',
    excerpt: 'This is a draft',
    featured_image_url: null,
    featured_image_width: null,
    featured_image_height: null,
    featured_image_variants: {},
    category: null,
    status: 'draft',
    author_name: 'Jane Smith',
    view_count: 0,
    reading_time_minutes: 3,
    created_at: '2026-02-01T00:00:00Z',
    updated_at: '2026-02-05T00:00:00Z',
    published_at: null,
  },
];

export const mockCounts = {
  total: 10,
  published: 5,
  draft: 3,
  archived: 2,
};

export function setupBlogClientPageTests() {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            posts: [],
            hasMore: false,
            counts: { total: 0, published: 0, draft: 0, archived: 0 },
          }),
        } as Response)
      )
    );
    vi.stubGlobal('open', vi.fn());

    if (!Element.prototype.hasPointerCapture) {
      Element.prototype.hasPointerCapture = vi.fn(() => false);
    }
    if (!Element.prototype.setPointerCapture) {
      Element.prototype.setPointerCapture = vi.fn();
    }
    if (!Element.prototype.releasePointerCapture) {
      Element.prototype.releasePointerCapture = vi.fn();
    }
    if (!Element.prototype.scrollIntoView) {
      Element.prototype.scrollIntoView = vi.fn();
    }

    vi.mocked(useToast).mockReturnValue({
      toast: mockToast,
    } as unknown as ReturnType<typeof useToast>);
    vi.mocked(useMerchantFeatures).mockReturnValue({
      autoBlogEnabled: false,
      blogEnabled: true,
      isLoading: false,
    } as ReturnType<typeof useMerchantFeatures>);
    vi.mocked(useMerchant).mockReturnValue({ merchant: null } as ReturnType<
      typeof useMerchant
    >);
  });

  afterEach(() => vi.unstubAllGlobals());
}
