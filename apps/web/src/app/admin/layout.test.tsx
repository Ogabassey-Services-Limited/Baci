import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPush = vi.fn();
const mockToast = vi.fn();
const mockUseAuth = vi.fn();
const mockCreateClient = vi.fn();

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

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin',
  useRouter: () => ({
    push: mockPush,
  }),
}));

vi.mock('@/components/csrf-initializer', () => ({
  CsrfInitializer: () => <div data-testid="csrf-initializer" />,
}));

vi.mock('@/components/logo', () => ({
  Logo: () => <span>Logo</span>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuItem: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuLabel: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  SheetTrigger: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TooltipContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  TooltipProvider: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  TooltipTrigger: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockCreateClient(),
}));

import AdminLayout from './layout';

describe('AdminLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      loading: false,
      signOut: vi.fn(),
      user: { id: 'user-1', email: 'admin@example.com' },
    });
    mockCreateClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: { is_platform_admin: true },
              error: null,
            }),
          })),
        })),
      })),
    });
  });

  it('mounts CsrfInitializer while verifying admin access', () => {
    mockUseAuth.mockReturnValue({
      loading: true,
      signOut: vi.fn(),
      user: { id: 'user-1', email: 'admin@example.com' },
    });

    render(
      <AdminLayout>
        <div>Admin content</div>
      </AdminLayout>
    );

    expect(screen.getByTestId('csrf-initializer')).toBeInTheDocument();
    expect(screen.getByText('Verifying admin access...')).toBeInTheDocument();
  });

  it('mounts the CSRF initializer for verified admin sessions', async () => {
    render(
      <AdminLayout>
        <div>Admin content</div>
      </AdminLayout>
    );

    await waitFor(() => {
      expect(screen.getByText('Admin content')).toBeInTheDocument();
    });

    expect(screen.getByTestId('csrf-initializer')).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('renders the local admin fallback while auth context is pending', () => {
    mockUseAuth.mockImplementation(() => {
      throw new Promise(() => {
        // Intentionally never resolves to keep the local fallback visible.
      });
    });

    render(
      <AdminLayout>
        <div>Admin content</div>
      </AdminLayout>
    );

    expect(screen.getByRole('status')).toHaveTextContent('Loading admin panel');
    expect(screen.getByTestId('csrf-initializer')).toBeInTheDocument();
  });
});
