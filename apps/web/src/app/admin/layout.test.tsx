import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlatformAdminAuth } from '@/lib/platform-admin-auth';

const mockGetPlatformAdminAuth = vi.fn<() => Promise<PlatformAdminAuth>>();
const mockRedirect = vi.fn((path: string): never => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});

vi.mock('next/navigation', () => ({
  redirect: (path: string) => mockRedirect(path),
}));

vi.mock('@/components/csrf-initializer', () => ({
  CsrfInitializer: () => <div data-testid="csrf-initializer" />,
}));

vi.mock('@/lib/platform-admin-auth', () => ({
  getPlatformAdminAuth: () => mockGetPlatformAdminAuth(),
}));

vi.mock('./admin-shell', () => ({
  AdminShell: ({
    adminEmail,
    children,
  }: {
    adminEmail: string | null;
    children: ReactNode;
  }) => (
    <section data-admin-email={adminEmail ?? ''} data-testid="admin-shell">
      {children}
    </section>
  ),
}));

import AdminLayout from './layout';

describe('AdminLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlatformAdminAuth.mockResolvedValue({
      status: 'authenticated',
      user: { email: 'admin@example.com', id: 'user-1' },
    });
  });

  it('renders the admin shell only after server-side admin authorization passes', async () => {
    const layout = await AdminLayout({
      children: <div>Admin content</div>,
    });

    render(layout);

    expect(mockGetPlatformAdminAuth).toHaveBeenCalledOnce();
    expect(screen.getByTestId('csrf-initializer')).toBeInTheDocument();
    expect(screen.getByTestId('admin-shell')).toHaveAttribute(
      'data-admin-email',
      'admin@example.com'
    );
    expect(screen.getByText('Admin content')).toBeInTheDocument();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('redirects unauthenticated users back to login with the admin return path', async () => {
    mockGetPlatformAdminAuth.mockResolvedValue({ status: 'unauthenticated' });

    await expect(
      AdminLayout({
        children: <div>Admin content</div>,
      })
    ).rejects.toThrow('NEXT_REDIRECT:/login?redirectTo=%2Fadmin');

    expect(mockRedirect).toHaveBeenCalledWith('/login?redirectTo=%2Fadmin');
  });

  it('redirects authenticated non-admin users to the merchant dashboard', async () => {
    mockGetPlatformAdminAuth.mockResolvedValue({ status: 'forbidden' });

    await expect(
      AdminLayout({
        children: <div>Admin content</div>,
      })
    ).rejects.toThrow('NEXT_REDIRECT:/dashboard');

    expect(mockRedirect).toHaveBeenCalledWith('/dashboard');
  });
});
