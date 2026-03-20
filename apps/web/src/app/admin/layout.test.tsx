import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminLayout from './layout';

const mockPush = vi.fn();
const mockToast = vi.fn();
const mockUseAuth = vi.fn();
const mockSingle = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin',
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/components/csrf-initializer', () => ({
  CsrfInitializer: () => <div data-testid="csrf-initializer" />,
}));

vi.mock('@/components/logo', () => ({
  Logo: () => <div data-testid="logo" />,
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: mockSingle,
        }),
      }),
    }),
  }),
}));

describe('AdminLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: { id: 'admin-user-id' },
      loading: false,
      signOut: vi.fn(),
    });
    mockSingle.mockResolvedValue({
      data: { is_platform_admin: true },
      error: null,
    });
  });

  it('mounts CsrfInitializer while verifying admin access', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'admin-user-id' },
      loading: true,
      signOut: vi.fn(),
    });

    render(
      <AdminLayout>
        <div>Admin content</div>
      </AdminLayout>
    );

    expect(screen.getByTestId('csrf-initializer')).toBeInTheDocument();
  });

  it('keeps CsrfInitializer mounted after admin access is verified', async () => {
    render(
      <AdminLayout>
        <div>Admin content</div>
      </AdminLayout>
    );

    await waitFor(() =>
      expect(screen.getByText('Admin content')).toBeInTheDocument()
    );

    expect(screen.getByTestId('csrf-initializer')).toBeInTheDocument();
  });
});
