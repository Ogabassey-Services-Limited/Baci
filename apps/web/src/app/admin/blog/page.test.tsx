import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/app/admin/blog/blog-list-client', () => ({
  BlogListClient: () => <div>Platform blog list</div>,
}));

import AdminBlogPage from './page';

describe('/admin/blog page', () => {
  it('renders the platform blog list client', () => {
    render(<AdminBlogPage />);
    expect(screen.getByText('Platform blog list')).toBeInTheDocument();
  });
});
