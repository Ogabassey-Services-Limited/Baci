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

import { redirect } from 'next/navigation';
import { getMerchantForUser } from '@/lib/merchant-server';
import MarketingPage, { metadata } from './page';

type MerchantForUserResult = Awaited<ReturnType<typeof getMerchantForUser>>;

function makeMerchantResult(
  merchant: MerchantForUserResult['merchant']
): MerchantForUserResult {
  return {
    merchant,
    merchantLookupStatus: merchant ? 'found' : 'not_found',
    staffAccess: {
      isOwner: true,
      isStaff: false,
      permissions: {},
      role: null,
    },
    user: null,
  };
}

describe('MarketingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getMerchantForUser).mockResolvedValue(
      makeMerchantResult({
        business_name: 'Test Store',
        business_type: 'retail',
        id: 'merchant-1',
        user_id: 'user-1',
      })
    );
  });

  it('exports expected metadata', () => {
    expect(metadata).toMatchObject({
      title: 'Marketing | Baci',
      description:
        'Reach more customers and track them efficiently across social platforms.',
    });
  });

  it('renders a marketing hub with discount codes and social platforms', async () => {
    render(await MarketingPage());

    expect(
      screen.getByRole('heading', { level: 1, name: 'Marketing' })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Reach more customers and track them efficiently across social platforms.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /open discount codes/i })
    ).toHaveAttribute('href', '/dashboard/marketing/discount-codes');
    expect(
      screen.getByRole('link', { name: /open social platforms/i })
    ).toHaveAttribute('href', '/dashboard/integrations');
    expect(screen.getAllByRole('link', { name: /open/i })).toHaveLength(2);
  });

  it('redirects to login when no merchant is available', async () => {
    vi.mocked(getMerchantForUser).mockResolvedValue(makeMerchantResult(null));

    await MarketingPage();

    expect(redirect).toHaveBeenCalledWith('/login');
  });
});
