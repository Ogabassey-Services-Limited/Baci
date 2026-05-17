import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockBlogEditorClient = vi.fn((_props: unknown) => (
  <div>Blog editor client</div>
));
const mockGetPlatformAdminAuth = vi.fn();
const mockRedirect = vi.fn((destination: string) => {
  throw new Error(`NEXT_REDIRECT:${destination}`);
});

vi.mock('@/app/admin/blog/blog-editor-client', () => ({
  BlogEditorClient: (props: unknown) => mockBlogEditorClient(props),
}));

vi.mock('next/navigation', () => ({
  redirect: (destination: string) => mockRedirect(destination),
}));

vi.mock('@/lib/platform-admin-auth', () => ({
  getPlatformAdminAuth: (...args: unknown[]) =>
    mockGetPlatformAdminAuth(...args),
}));

import NewAdminBlogPostPage from './page';

describe('/admin/blog/new page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlatformAdminAuth.mockResolvedValue({
      status: 'authenticated',
      user: { email: 'admin@example.com', id: 'admin-1' },
    });
  });

  it('renders editor client in create mode', async () => {
    render(await NewAdminBlogPostPage());
    expect(screen.getByText('Blog editor client')).toBeInTheDocument();
    expect(mockBlogEditorClient).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'create' })
    );
  });

  it('redirects unauthenticated users to login', async () => {
    mockGetPlatformAdminAuth.mockResolvedValueOnce({
      status: 'unauthenticated',
    });

    await expect(NewAdminBlogPostPage()).rejects.toThrow(
      'NEXT_REDIRECT:/login?redirect=%2Fadmin'
    );
    expect(mockRedirect).toHaveBeenCalledWith('/login?redirect=%2Fadmin');
  });

  it('redirects forbidden users to dashboard', async () => {
    mockGetPlatformAdminAuth.mockResolvedValueOnce({ status: 'forbidden' });

    await expect(NewAdminBlogPostPage()).rejects.toThrow(
      'NEXT_REDIRECT:/dashboard'
    );
    expect(mockRedirect).toHaveBeenCalledWith('/dashboard');
  });
});
