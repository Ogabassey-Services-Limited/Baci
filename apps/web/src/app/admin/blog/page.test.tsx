import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockBlogListClient = vi.fn((_props: unknown) => (
  <div>Platform blog list</div>
));
const mockCreateClient = vi.fn();

vi.mock('@/app/admin/blog/blog-list-client', () => ({
  BlogListClient: (props: unknown) => mockBlogListClient(props),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

const mockSupabase = {
  eq: vi.fn(),
  from: vi.fn(),
  is: vi.fn(),
  order: vi.fn(),
  range: vi.fn(),
  select: vi.fn(),
};

mockSupabase.from.mockReturnValue(mockSupabase);
mockSupabase.select.mockReturnValue(mockSupabase);
mockSupabase.eq.mockReturnValue(mockSupabase);
mockSupabase.is.mockReturnValue(mockSupabase);
mockSupabase.order.mockReturnValue(mockSupabase);

import AdminBlogPage from './page';

describe('/admin/blog page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue(mockSupabase);
    mockSupabase.range.mockResolvedValue({
      data: [
        {
          id: 'post-1',
          slug: 'launch-faster',
          status: 'draft',
          title: 'Launch Faster',
        },
      ],
      error: null,
    });
  });

  it('passes server-loaded posts into BlogListClient', async () => {
    render(await AdminBlogPage());

    expect(screen.getByText('Platform blog list')).toBeInTheDocument();
    expect(mockBlogListClient).toHaveBeenCalledWith(
      expect.objectContaining({
        initialError: null,
        initialPosts: [
          {
            id: 'post-1',
            slug: 'launch-faster',
            status: 'draft',
            title: 'Launch Faster',
          },
        ],
      })
    );
  });

  it('passes an error message when the server query fails', async () => {
    mockSupabase.range.mockResolvedValueOnce({
      data: null,
      error: { message: 'boom' },
    });

    render(await AdminBlogPage());

    expect(mockBlogListClient).toHaveBeenCalledWith(
      expect.objectContaining({
        initialError: 'Failed to load platform blog posts',
        initialPosts: [],
      })
    );
  });
});
