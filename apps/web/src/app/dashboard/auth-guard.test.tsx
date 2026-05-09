import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface DashboardProvidersMockProps {
  children: ReactNode;
  initialMerchant?: unknown;
  initialStaffAccess?: unknown;
  nonce?: string;
}

const mocks = vi.hoisted(() => ({
  getMerchantForUser: vi.fn(),
  headers: vi.fn(),
  redirect: vi.fn((target: string) => {
    throw new Error(`NEXT_REDIRECT:${target}`);
  }),
  dashboardProviders: vi.fn(({ children }: DashboardProvidersMockProps) => (
    <div data-testid="dashboard-providers">{children}</div>
  )),
}));

vi.mock('next/headers', () => ({
  headers: mocks.headers,
}));

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}));

vi.mock('@/lib/merchant-server', () => ({
  getMerchantForUser: mocks.getMerchantForUser,
}));

vi.mock('@/app/dashboard/providers', () => ({
  DashboardProviders: (props: DashboardProvidersMockProps) =>
    mocks.dashboardProviders(props),
}));

describe('DashboardAuthGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mocks.headers.mockResolvedValue({
      get: (name: string) =>
        name === 'x-nonce' ? '123e4567-e89b-12d3-a456-426614174000' : null,
    });
  });

  it('redirects to onboarding when a user definitively has no merchant access', async () => {
    mocks.getMerchantForUser.mockResolvedValue({
      merchant: null,
      merchantLookupStatus: 'not_found',
      staffAccess: {
        isStaff: false,
        isOwner: false,
        role: null,
        permissions: {},
      },
      user: { id: 'user-1' },
    });

    const { DashboardAuthGuard } = await import('@/app/dashboard/auth-guard');

    await expect(
      DashboardAuthGuard({ children: <div>Dashboard content</div> })
    ).rejects.toThrow('NEXT_REDIRECT:/onboarding');
  });

  it('renders an error state when merchant lookup failed unexpectedly', async () => {
    mocks.getMerchantForUser.mockResolvedValue({
      merchant: null,
      merchantLookupStatus: 'error',
      staffAccess: {
        isStaff: false,
        isOwner: false,
        role: null,
        permissions: {},
      },
      user: { id: 'user-1' },
    });

    const { DashboardAuthGuard } = await import('@/app/dashboard/auth-guard');
    const tree = await DashboardAuthGuard({
      children: <div>Dashboard content</div>,
    });

    render(tree);

    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      "We couldn't load your dashboard right now. Please refresh and try again."
    );
  });

  it('passes the request nonce into dashboard providers', async () => {
    mocks.getMerchantForUser.mockResolvedValue({
      merchant: { id: 'merchant-1' },
      merchantLookupStatus: 'found',
      staffAccess: {
        isStaff: false,
        isOwner: true,
        role: null,
        permissions: {},
      },
      user: { id: 'user-1' },
    });

    const { DashboardAuthGuard } = await import('@/app/dashboard/auth-guard');
    const tree = await DashboardAuthGuard({
      children: <div>Dashboard content</div>,
    });

    render(tree);

    expect(mocks.dashboardProviders).toHaveBeenCalledWith(
      expect.objectContaining({
        nonce: '123e4567-e89b-12d3-a456-426614174000',
      })
    );
    expect(screen.getByText('Dashboard content')).toBeInTheDocument();
  });

  it('drops malformed nonce headers before rendering dashboard providers', async () => {
    mocks.headers.mockResolvedValueOnce({
      get: (name: string) => (name === 'x-nonce' ? '<bad nonce>' : null),
    });
    mocks.getMerchantForUser.mockResolvedValue({
      merchant: { id: 'merchant-1' },
      merchantLookupStatus: 'found',
      staffAccess: {
        isStaff: false,
        isOwner: true,
        role: null,
        permissions: {},
      },
      user: { id: 'user-1' },
    });

    const { DashboardAuthGuard } = await import('@/app/dashboard/auth-guard');
    const tree = await DashboardAuthGuard({
      children: <div>Dashboard content</div>,
    });

    render(tree);

    expect(mocks.dashboardProviders).toHaveBeenCalledWith(
      expect.objectContaining({
        nonce: undefined,
      })
    );
  });
});
