import { render, screen } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/merchant-server', () => ({
  getMerchantForUser: vi.fn(),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: PropsWithChildren<{ href: string }>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

// `listShippingConfig` and `ShippingClient` back the Suspense-wrapped async
// content below the page shell. React's client renderer doesn't resolve
// async Server Components in a test environment, so these are stubbed to
// keep this suite focused on the page's own auth gate and static shell.
vi.mock('./actions', () => ({
  listShippingConfig: vi.fn(
    () =>
      new Promise(() => {
        // Deliberately never resolves.
      })
  ),
}));

vi.mock('./shipping-client', () => ({
  ShippingClient: () => <div data-testid="shipping-client" />,
}));

import { redirect } from 'next/navigation';
import { getMerchantForUser } from '@/lib/merchant-server';
import ShippingSettingsPage from './page';

describe('ShippingSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to login when no merchant is available', async () => {
    vi.mocked(getMerchantForUser).mockResolvedValue({
      merchant: null,
    } as never);

    await ShippingSettingsPage();

    expect(redirect).toHaveBeenCalledWith('/login');
  });

  it('renders the page shell with a back link for an authenticated merchant', async () => {
    vi.mocked(getMerchantForUser).mockResolvedValue({
      merchant: { id: 'merchant-1' },
    } as never);

    render(await ShippingSettingsPage());

    expect(
      screen.getByRole('heading', { name: /shipping rates/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/configure delivery zones, fees, and pickup options/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /back to settings/i })
    ).toHaveAttribute('href', '/dashboard/settings');
  });
});
