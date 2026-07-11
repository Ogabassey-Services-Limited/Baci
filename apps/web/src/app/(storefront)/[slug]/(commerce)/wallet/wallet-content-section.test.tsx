import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/storefront/ogabassey/pages/wallet', () => ({
  OgabasseyV2Wallet: ({
    initialShowFunding,
    initialShowUsdtFunding,
    initialUsdtAmount,
  }: {
    initialShowFunding?: boolean;
    initialShowUsdtFunding?: boolean;
    initialUsdtAmount?: number;
  }) => (
    <div
      data-initial-show-funding={String(initialShowFunding ?? false)}
      data-initial-show-usdt={String(initialShowUsdtFunding ?? false)}
      data-initial-usdt-amount={String(initialUsdtAmount ?? '')}
    >
      Wallet UI
    </div>
  ),
}));

import { WalletContentSection } from './wallet-content-section';

describe('WalletContentSection', () => {
  it('renders crawler-visible structure with an accessible page title', () => {
    render(<WalletContentSection />);

    const heading = screen.getByRole('heading', {
      level: 1,
      name: 'Wallet Balance',
    });
    const section = heading.closest('section');

    expect(heading).toHaveClass('sr-only');
    expect(section).toHaveAttribute('aria-labelledby', 'wallet-page-title');
    expect(screen.getByText('Wallet UI')).toBeInTheDocument();
  });

  it('forwards the funding deep-link state to the wallet UI', () => {
    render(<WalletContentSection initialShowFunding />);

    expect(screen.getByText('Wallet UI')).toHaveAttribute(
      'data-initial-show-funding',
      'true'
    );
  });

  it('forwards the USDT funding deep-link state and amount', () => {
    render(
      <WalletContentSection initialShowUsdtFunding initialUsdtAmount={65} />
    );

    expect(screen.getByText('Wallet UI')).toHaveAttribute(
      'data-initial-show-usdt',
      'true'
    );
    expect(screen.getByText('Wallet UI')).toHaveAttribute(
      'data-initial-usdt-amount',
      '65'
    );
  });
});
