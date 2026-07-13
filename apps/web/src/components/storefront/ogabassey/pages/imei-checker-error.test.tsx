import { render, screen } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImeiCheckerError } from './imei-checker-error';

const mocks = vi.hoisted(() => ({ useMerchantSafe: vi.fn() }));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchantSafe: mocks.useMerchantSafe,
}));

describe('ImeiCheckerError', () => {
  beforeEach(() => {
    mocks.useMerchantSafe.mockReturnValue({ basePath: '/ogabassey' });
  });

  it('renders a wallet funding link for an insufficient-balance error', () => {
    render(
      <ImeiCheckerError
        error="Insufficient wallet balance"
        needsWalletFunding
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Insufficient wallet balance'
    );
    expect(
      screen.getByRole('link', { name: /fund wallet/i })
    ).toHaveAttribute('href', '/ogabassey/wallet?fund=1');
  });

  it('keeps the funding link root-relative on domain storefronts', () => {
    mocks.useMerchantSafe.mockReturnValue({ basePath: undefined });

    render(
      <ImeiCheckerError
        error="Insufficient wallet balance"
        needsWalletFunding
      />
    );

    expect(
      screen.getByRole('link', { name: /fund wallet/i })
    ).toHaveAttribute('href', '/wallet?fund=1');
  });

  it('does not render a funding link for other errors', () => {
    render(
      <ImeiCheckerError error="Provider unavailable" needsWalletFunding={false} />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Provider unavailable');
    expect(
      screen.queryByRole('link', { name: /fund wallet/i })
    ).not.toBeInTheDocument();
  });
});
