import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockBlogEditorClient = vi.fn((_props: unknown) => (
  <div>Blog editor client</div>
));
const mockCreateClient = vi.fn();
const mockNotFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});

vi.mock('@/app/admin/blog/blog-editor-client', () => ({
  BlogEditorClient: (props: unknown) => mockBlogEditorClient(props),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

vi.mock('next/navigation', () => ({
  notFound: () => mockNotFound(),
}));

const mockSupabase = {
  eq: vi.fn(),
  from: vi.fn(),
  is: vi.fn(),
  select: vi.fn(),
  single: vi.fn(),
};

mockSupabase.from.mockReturnValue(mockSupabase);
mockSupabase.select.mockReturnValue(mockSupabase);
mockSupabase.eq.mockReturnValue(mockSupabase);
mockSupabase.is.mockReturnValue(mockSupabase);

import EditAdminBlogPostPage from './page';

describe('/admin/blog/[id]/edit page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue(mockSupabase);
    mockSupabase.single.mockResolvedValue({
      data: {
        id: 'post-1',
        slug: 'launch-faster',
        status: 'draft',
        title: 'Launch Faster',
      },
      error: null,
    });
  });

  it('loads the post on the server and renders editor client in edit mode', async () => {
    render(
      await EditAdminBlogPostPage({
        params: Promise.resolve({ id: 'post-1' }),
      })
    );

    expect(screen.getByText('Blog editor client')).toBeInTheDocument();
    expect(mockBlogEditorClient).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'edit',
        postId: 'post-1',
      })
    );
    expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'post-1');
  });

  it('calls notFound when post lookup fails', async () => {
    mockSupabase.single.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST116' },
    });

    await expect(
      EditAdminBlogPostPage({
        params: Promise.resolve({ id: 'missing' }),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mockNotFound).toHaveBeenCalled();
  });
});
