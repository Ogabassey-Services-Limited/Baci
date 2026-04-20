import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getMerchantForUser: vi.fn(),
  redirect: vi.fn((target: string) => {
    throw new Error(`NEXT_REDIRECT:${target}`);
  }),
}));

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}));

vi.mock('@/lib/merchant-server', () => ({
  getMerchantForUser: mocks.getMerchantForUser,
}));

vi.mock('./providers', () => ({
  DashboardProviders: ({
    children,
  }: {
    children: ReactNode;
    initialMerchant?: unknown;
    initialStaffAccess?: unknown;
  }) => <div data-testid="dashboard-providers">{children}</div>,
}));

describe('DashboardAuthGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
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

    const { DashboardAuthGuard } = await import('./auth-guard');

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

    const { DashboardAuthGuard } = await import('./auth-guard');
    const tree = await DashboardAuthGuard({
      children: <div>Dashboard content</div>,
    });

    render(tree);

    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      "We couldn't load your dashboard right now. Please refresh and try again."
    );
  });
});
