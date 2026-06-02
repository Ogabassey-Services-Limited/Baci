import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PaymentLogo, PaymentTrustBadges } from './PaymentLogos';

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { alt, fill: _fill, priority: _priority, ...imageProps } = props;

    return <img {...imageProps} alt={String(alt ?? '')} />;
  },
}));

describe('PaymentLogos', () => {
  it('renders an accessible payment partner logo', () => {
    render(<PaymentLogo partner="paystack" />);

    expect(
      screen.getByRole('img', {
        name: /paystack - secure payment gateway for africa/i,
      })
    ).toBeInTheDocument();
  });

  it('renders trust badges as a themed semantic list', () => {
    render(<PaymentTrustBadges />);

    expect(screen.getByText(/secure payments via/i)).toHaveClass(
      'text-store-background-text/60'
    );

    const logoList = screen.getByRole('list');
    expect(within(logoList).getAllByRole('listitem')).toHaveLength(4);
    expect(
      within(logoList).getByRole('img', {
        name: /paystack payment gateway logo/i,
      })
    ).toBeInTheDocument();
  });
});
