import { render, screen } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
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

vi.mock('@/lib/merchant-server', () => ({
  getMerchantForUser: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchant: () => ({
    merchant: { id: 'merchant-1', slug: 'ogabassey' },
    reloadMerchant: vi.fn(),
  }),
}));

vi.mock('@/app/dashboard/settings/components/settings-form', () => ({
  SettingsForm: ({
    initialMerchant,
  }: {
    initialMerchant: { site_description: string };
  }) => (
    <div
      data-testid="settings-form"
      data-description={initialMerchant.site_description}
    />
  ),
}));

import { cookies } from 'next/headers';
import { getMerchantForUser } from '@/lib/merchant-server';
import { createClient } from '@/lib/supabase/server';
import SettingsPage from './page';

function createQueryMock(data: Record<string, unknown>) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue({
    data,
    error: null,
  });
  return query;
}

function createSettingsClientMock(siteDescription = '') {
  const featureQuery = createQueryMock({ blog_enabled: false });
  const profileQuery = createQueryMock({ site_description: siteDescription });
  return {
    from: vi.fn((table: string) =>
      table === 'merchants' ? profileQuery : featureQuery
    ),
  };
}

describe('dashboard settings page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cookies).mockResolvedValue({} as never);
  });

  it('renders the trust and policies navigation card', async () => {
    vi.mocked(getMerchantForUser).mockResolvedValue({
      merchant: { id: 'merchant-1', country: 'NG' },
    } as never);
    vi.mocked(createClient).mockReturnValue(
      createSettingsClientMock() as never
    );

    render(await SettingsPage());

    expect(screen.getByTestId('settings-form')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /manage trust & policies/i })
    ).toHaveAttribute('href', '/dashboard/settings/trust');
    expect(
      screen.getByRole('link', { name: /manage verification/i })
    ).toHaveAttribute('href', '/dashboard/settings/kyc');
    expect(
      screen.getByRole('link', { name: /manage shipping rates/i })
    ).toHaveAttribute('href', '/dashboard/settings/shipping');
  });

  it('hides Nigerian KYC settings for India merchants', async () => {
    vi.mocked(getMerchantForUser).mockResolvedValue({
      merchant: { id: 'merchant-1', country: 'IN' },
    } as never);
    vi.mocked(createClient).mockReturnValue(
      createSettingsClientMock() as never
    );

    render(await SettingsPage());

    expect(
      screen.queryByRole('link', { name: /manage verification/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/business verification/i)
    ).not.toBeInTheDocument();
  });

  it('loads an existing storefront description into the settings form', async () => {
    vi.mocked(getMerchantForUser).mockResolvedValue({
      merchant: { id: 'merchant-1', country: 'NG' },
    } as never);
    vi.mocked(createClient).mockReturnValue(
      createSettingsClientMock('Existing authored description') as never
    );

    render(await SettingsPage());

    expect(screen.getByTestId('settings-form')).toHaveAttribute(
      'data-description',
      'Existing authored description'
    );
  });
});
