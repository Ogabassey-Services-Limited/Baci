import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const mockBlogEditorClient = vi.fn((_props: unknown) => (
  <div>Blog editor client</div>
));

vi.mock('@/app/admin/blog/blog-editor-client', () => ({
  BlogEditorClient: (props: unknown) => mockBlogEditorClient(props),
}));

import EditAdminBlogPostPage from './page';

describe('/admin/blog/[id]/edit page', () => {
  it('renders editor client in edit mode with post id', async () => {
    render(
      await EditAdminBlogPostPage({
        params: Promise.resolve({ id: 'post-1' }),
      })
    );

    expect(screen.getByText('Blog editor client')).toBeInTheDocument();
    expect(mockBlogEditorClient).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'edit', postId: 'post-1' })
    );
  });
});
