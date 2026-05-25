import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { UtilityPaymentMethodSelector } from './UtilityPaymentMethodSelector';

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

describe('UtilityPaymentMethodSelector', () => {
  it('selects wallet when a balance is available', async () => {
    const user = userEvent.setup();
    const onSelectWallet = vi.fn();

    render(
      <UtilityPaymentMethodSelector
        canUseWallet={true}
        isLoading={false}
        onSelectCard={vi.fn()}
        onSelectWallet={onSelectWallet}
        selectedPaymentMethod="card"
        walletBalance={500}
        walletLoading={false}
      />
    );

    await user.click(screen.getByRole('radio', { name: /pay with wallet/i }));

    expect(onSelectWallet).toHaveBeenCalledOnce();
    expect(screen.getByText(/500 available/i)).toBeInTheDocument();
  });

  it('selects card and applies merchant theming to the selected option', async () => {
    const user = userEvent.setup();
    const onSelectCard = vi.fn();

    render(
      <UtilityPaymentMethodSelector
        canUseWallet={true}
        isLoading={false}
        onSelectCard={onSelectCard}
        onSelectWallet={vi.fn()}
        selectedPaymentMethod="card"
        walletBalance={500}
        walletLoading={false}
      />
    );

    const cardOption = screen.getByRole('radio', { name: /pay with card/i });
    expect(cardOption).toHaveClass('border-store-primary');

    await user.click(cardOption);

    expect(onSelectCard).toHaveBeenCalledOnce();
  });

  it('shows a disabled wallet option while its balance is loading', () => {
    render(
      <UtilityPaymentMethodSelector
        canUseWallet={false}
        isLoading={false}
        onSelectCard={vi.fn()}
        onSelectWallet={vi.fn()}
        selectedPaymentMethod="card"
        walletBalance={0}
        walletLoading={true}
      />
    );

    expect(
      screen.getByRole('radio', { name: /pay with wallet/i })
    ).toBeDisabled();
    expect(screen.getByText(/checking wallet balance/i)).toBeInTheDocument();
  });

  it('does not show wallet when no wallet credit is available', () => {
    render(
      <UtilityPaymentMethodSelector
        canUseWallet={false}
        isLoading={false}
        onSelectCard={vi.fn()}
        onSelectWallet={vi.fn()}
        selectedPaymentMethod="card"
        walletBalance={0}
        walletLoading={false}
      />
    );

    expect(
      screen.queryByRole('radio', { name: /pay with wallet/i })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /pay with card/i })).toBeEnabled();
  });

  it('disables available methods while a checkout request is pending', () => {
    render(
      <UtilityPaymentMethodSelector
        canUseWallet={true}
        isLoading={true}
        onSelectCard={vi.fn()}
        onSelectWallet={vi.fn()}
        selectedPaymentMethod="wallet"
        walletBalance={500}
        walletLoading={false}
      />
    );

    expect(
      screen.getByRole('radio', { name: /pay with wallet/i })
    ).toBeDisabled();
    expect(screen.getByRole('radio', { name: /pay with card/i })).toBeDisabled();
  });
});
