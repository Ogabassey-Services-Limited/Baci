import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const mockGetMerchantForUser = vi.fn();
const mockGetCachedFeatureSettings = vi.fn();
const mockCreateClient = vi.fn();
const mockCookies = vi.fn();

vi.mock('@/lib/merchant-server', () => ({
  getMerchantForUser: () => mockGetMerchantForUser(),
}));

vi.mock('@/lib/cached-data', () => ({
  getCachedFeatureSettings: (...args: unknown[]) =>
    mockGetCachedFeatureSettings(...args),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

vi.mock('next/headers', () => ({
  cookies: () => mockCookies(),
}));

vi.mock('./blog-client-page', () => ({
  BlogClientPage: ({ initialPosts }: { initialPosts: unknown[] }) => (
    <div data-testid="blog-client-page">{initialPosts.length}</div>
  ),
}));

import BlogPage from './page';

describe('BlogPage', () => {
  it('selects featured image metadata for dashboard readiness prefetch', async () => {
    const range = vi.fn().mockResolvedValue({ data: [], error: null });
    const order = vi.fn(() => ({ range }));
    const eq = vi.fn(() => ({ order }));
    const selectedFields: string[] = [];
    const from = vi.fn();
    const countEq = vi.fn();
    const countBuilder = {
      eq: countEq,
    };
    countEq.mockReturnValue(countBuilder);

    from.mockImplementation((table: string) => {
      if (table !== 'blog_posts') {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        select: (fields: string) => {
          if (fields.includes('featured_image_width')) {
            selectedFields.push(fields);
            return { eq };
          }

          return countBuilder;
        },
      };
    });

    mockGetMerchantForUser.mockResolvedValue({
      merchant: { id: 'merchant-1', slug: 'test-store' },
    });
    mockGetCachedFeatureSettings.mockResolvedValue({ blog_enabled: true });
    mockCookies.mockResolvedValue({});
    mockCreateClient.mockReturnValue({ from });

    render(await BlogPage());

    expect(screen.getByTestId('blog-client-page')).toHaveTextContent('0');
    expect(selectedFields[0]).toEqual(
      expect.stringContaining('featured_image_width')
    );
    expect(selectedFields[0]).toEqual(
      expect.stringContaining('featured_image_height')
    );
    expect(selectedFields[0]).toEqual(
      expect.stringContaining('featured_image_variants')
    );
  });
});
