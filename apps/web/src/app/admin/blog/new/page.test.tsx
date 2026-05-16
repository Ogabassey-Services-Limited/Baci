import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const mockBlogEditorClient = vi.fn((_props: unknown) => (
  <div>Blog editor client</div>
));

vi.mock('@/app/admin/blog/blog-editor-client', () => ({
  BlogEditorClient: (props: unknown) => mockBlogEditorClient(props),
}));

import NewAdminBlogPostPage from './page';

describe('/admin/blog/new page', () => {
  it('renders editor client in create mode', () => {
    render(<NewAdminBlogPostPage />);
    expect(screen.getByText('Blog editor client')).toBeInTheDocument();
    expect(mockBlogEditorClient).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'create' })
    );
  });
});
