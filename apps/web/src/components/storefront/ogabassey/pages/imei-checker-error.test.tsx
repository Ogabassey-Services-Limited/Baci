import { render, screen } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ImeiCheckerError } from './imei-checker-error';

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

describe('ImeiCheckerError', () => {
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
