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
        showWalletRow={true}
        walletBalance={500}
        walletLoading={false}
      />
    );

    await user.click(screen.getByRole('radio', { name: /pay with wallet/i }));

    expect(onSelectWallet).toHaveBeenCalledOnce();
    expect(screen.getByText(/500 available/i)).toBeInTheDocument();
  });

  it('marks the wallet option as recommended', () => {
    render(
      <UtilityPaymentMethodSelector
        canUseWallet={true}
        isLoading={false}
        onSelectCard={vi.fn()}
        onSelectWallet={vi.fn()}
        selectedPaymentMethod="wallet"
        showWalletRow={true}
        walletBalance={500}
        walletLoading={false}
      />
    );

    expect(screen.getByText('Recommended')).toBeInTheDocument();
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
        showWalletRow={true}
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
        showWalletRow={false}
        walletBalance={0}
        walletLoading={true}
      />
    );

    expect(
      screen.getByRole('radio', { name: /pay with wallet/i })
    ).toBeDisabled();
    expect(screen.getByText(/checking wallet balance/i)).toBeInTheDocument();
  });

  it('shows a disabled wallet option with a funding hint at zero balance', () => {
    render(
      <UtilityPaymentMethodSelector
        canUseWallet={false}
        isLoading={false}
        onSelectCard={vi.fn()}
        onSelectWallet={vi.fn()}
        selectedPaymentMethod="card"
        showWalletRow={true}
        walletBalance={0}
        walletLoading={false}
      />
    );

    expect(
      screen.getByRole('radio', { name: /pay with wallet/i })
    ).toBeDisabled();
    expect(
      screen.getByText(/fund your wallet to pay without card fees/i)
    ).toBeInTheDocument();
  });

  it('does not show wallet for signed-out customers', () => {
    render(
      <UtilityPaymentMethodSelector
        canUseWallet={false}
        isLoading={false}
        onSelectCard={vi.fn()}
        onSelectWallet={vi.fn()}
        selectedPaymentMethod="card"
        showWalletRow={false}
        walletBalance={0}
        walletLoading={false}
      />
    );

    expect(
      screen.queryByRole('radio', { name: /pay with wallet/i })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /pay with card/i })).toBeEnabled();
  });

  it('invokes onFundWallet from the bank-transfer funding CTA', async () => {
    const user = userEvent.setup();
    const onFundWallet = vi.fn();

    render(
      <UtilityPaymentMethodSelector
        canUseWallet={false}
        isLoading={false}
        onFundWallet={onFundWallet}
        onSelectCard={vi.fn()}
        onSelectWallet={vi.fn()}
        selectedPaymentMethod="card"
        showWalletRow={true}
        walletBalance={0}
        walletLoading={false}
      />
    );

    await user.click(
      screen.getByRole('button', { name: /fund by bank transfer/i })
    );

    expect(onFundWallet).toHaveBeenCalledOnce();
  });

  it('hides the funding CTA when onFundWallet is not provided', () => {
    render(
      <UtilityPaymentMethodSelector
        canUseWallet={true}
        isLoading={false}
        onSelectCard={vi.fn()}
        onSelectWallet={vi.fn()}
        selectedPaymentMethod="wallet"
        showWalletRow={true}
        walletBalance={500}
        walletLoading={false}
      />
    );

    expect(
      screen.queryByRole('button', { name: /fund by bank transfer/i })
    ).not.toBeInTheDocument();
  });

  it('disables available methods while a checkout request is pending', () => {
    render(
      <UtilityPaymentMethodSelector
        canUseWallet={true}
        isLoading={true}
        onSelectCard={vi.fn()}
        onSelectWallet={vi.fn()}
        selectedPaymentMethod="wallet"
        showWalletRow={true}
        walletBalance={500}
        walletLoading={false}
      />
    );

    expect(
      screen.getByRole('radio', { name: /pay with wallet/i })
    ).toBeDisabled();
    expect(screen.getByRole('radio', { name: /pay with card/i })).toBeDisabled();
  });

  it('moves focus and selects wallet with arrow keys', async () => {
    const user = userEvent.setup();
    const onSelectWallet = vi.fn();

    render(
      <UtilityPaymentMethodSelector
        canUseWallet={true}
        isLoading={false}
        onSelectCard={vi.fn()}
        onSelectWallet={onSelectWallet}
        selectedPaymentMethod="card"
        showWalletRow={true}
        walletBalance={500}
        walletLoading={false}
      />
    );

    screen.getByRole('radio', { name: /pay with card/i }).focus();
    await user.keyboard('{ArrowUp}');

    expect(onSelectWallet).toHaveBeenCalledOnce();
    expect(
      screen.getByRole('radio', { name: /pay with wallet/i })
    ).toHaveFocus();
  });
});
