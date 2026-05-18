import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';

// Mock next/navigation and next/link
vi.mock('next/navigation', () => ({
  usePathname: vi.fn().mockReturnValue('/dashboard'),
  useRouter: vi.fn().mockReturnValue({ push: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: { children: React.ReactNode; href: string } & Record<string, unknown>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuth: vi.fn().mockReturnValue({
    user: { id: 'user-1', email: 'test@example.com' },
    loading: false,
    signOut: vi.fn(),
  }),
}));

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchant: vi.fn().mockReturnValue({
    merchant: {
      id: 'merchant-1',
      slug: 'test-store',
      country: 'NG',
      custom_domain: null,
    },
    loading: false,
    updateMerchant: vi.fn(),
    hasPermission: vi.fn().mockReturnValue(true),
    staffAccess: { isOwner: true },
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ count: 0 }),
      }),
    }),
  }),
}));

// Mock UI components to simplify rendering
vi.mock('@/components/notifications/notification-banner', () => ({
  NotificationBanner: () => null,
}));

vi.mock('@/components/notifications/notification-center', () => ({
  NotificationCenter: () => null,
}));

import { useMerchant } from '@/hooks/use-merchant-client';
import DashboardClientLayout from './client-layout';

describe('DashboardClientLayout', () => {
  it('renders the Migrations nav item', () => {
    render(
      <DashboardClientLayout>
        <div>Test Content</div>
      </DashboardClientLayout>
    );

    const migrationLinks = screen.getAllByText('Migrations');
    expect(migrationLinks.length).toBeGreaterThan(0);
  });

  it('renders the Migrations link with correct href', () => {
    render(
      <DashboardClientLayout>
        <div>Test Content</div>
      </DashboardClientLayout>
    );

    const migrationLinks = screen.getAllByRole('link', { name: 'Migrations' });
    expect(migrationLinks.length).toBeGreaterThan(0);
    expect(migrationLinks[0]).toHaveAttribute('href', '/dashboard/migrations');
  });

  it('renders core navigation items', () => {
    render(
      <DashboardClientLayout>
        <div>Test Content</div>
      </DashboardClientLayout>
    );

    expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Orders').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Products').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Agentic' })[0]).toHaveAttribute(
      'href',
      '/dashboard/agentic'
    );
  });

  it('renders children content', () => {
    render(
      <DashboardClientLayout>
        <div>Migration Page Content</div>
      </DashboardClientLayout>
    );

    expect(screen.getByText('Migration Page Content')).toBeInTheDocument();
  });

  it('hides the Migrations nav item when the merchant lacks permission', () => {
    vi.mocked(useMerchant).mockReturnValue({
      merchant: {
        id: 'merchant-1',
        slug: 'test-store',
        country: 'NG',
        custom_domain: null,
      },
      loading: false,
      updateMerchant: vi.fn(),
      hasPermission: vi.fn(() => false),
      staffAccess: { isOwner: false },
    } as never);

    render(
      <DashboardClientLayout>
        <div>Test Content</div>
      </DashboardClientLayout>
    );

    expect(
      screen.queryByRole('link', { name: 'Migrations' })
    ).not.toBeInTheDocument();
  });

  it('hides Santa Campaign for non-ogabassey merchants even when the user is owner', () => {
    vi.mocked(useMerchant).mockReturnValue({
      merchant: {
        id: 'merchant-1',
        slug: 'test-store',
        country: 'NG',
        custom_domain: null,
      },
      loading: false,
      updateMerchant: vi.fn(),
      hasPermission: vi.fn(() => true),
      staffAccess: { isOwner: true },
    } as never);

    render(
      <DashboardClientLayout>
        <div>Test Content</div>
      </DashboardClientLayout>
    );

    expect(
      screen.queryByRole('link', { name: 'Santa Campaign' })
    ).not.toBeInTheDocument();
  });
});
