import { fireEvent, render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import { WalletPayment } from './WalletPayment';
import type { WalletPaymentState } from './wallet-payment-state';

const baseState: WalletPaymentState = {
  coversFully: false,
  effectiveTotal: 5000,
  infoShouldRender: false,
  isActive: false,
  portion: 3000,
  residualToGateway: 2000,
  shouldRender: true,
  statusShouldRender: false,
};

describe('WalletPayment', () => {
  it('emits a wallet selection when the partial wallet row is pressed', () => {
    const onWalletToggle = jest.fn();

    render(
      <WalletPayment
        colors={Colors.light}
        onWalletToggle={onWalletToggle}
        state={baseState}
        walletBalance={3000}
        walletIsLoading={false}
      />
    );

    fireEvent.press(screen.getByLabelText('Use wallet credit, ₦3,000 of ₦5,000'));

    expect(onWalletToggle).toHaveBeenCalledWith({
      amount: 3000,
      use: true,
    });
  });

  it('emits a disabled wallet selection when the active wallet row is pressed', () => {
    const onWalletToggle = jest.fn();

    render(
      <WalletPayment
        colors={Colors.light}
        onWalletToggle={onWalletToggle}
        state={{ ...baseState, isActive: true }}
        walletBalance={3000}
        walletIsLoading={false}
      />
    );

    fireEvent.press(screen.getByLabelText('Use wallet credit, ₦3,000 of ₦5,000'));

    expect(onWalletToggle).toHaveBeenCalledWith({
      amount: 0,
      use: false,
    });
  });

  it('uses a stable button role when wallet covers the full order', () => {
    const onWalletToggle = jest.fn();

    render(
      <WalletPayment
        colors={Colors.light}
        onWalletToggle={onWalletToggle}
        state={{
          ...baseState,
          coversFully: true,
          effectiveTotal: 3000,
          portion: 3000,
          residualToGateway: 0,
        }}
        walletBalance={3000}
        walletIsLoading={false}
      />
    );

    const walletRow = screen.getByLabelText('Pay with wallet, ₦3,000 available');

    expect(walletRow.props.accessibilityRole).toBe('button');
    expect(walletRow.props.accessibilityState).toMatchObject({
      checked: false,
      disabled: false,
    });
    fireEvent.press(walletRow);
    expect(onWalletToggle).toHaveBeenCalledWith({
      amount: 3000,
      use: true,
    });
  });

  it('renders as disabled when no wallet toggle callback is provided', () => {
    const onWalletToggle = jest.fn();
    render(
      <WalletPayment
        colors={Colors.light}
        state={baseState}
        walletBalance={3000}
        walletIsLoading={false}
      />
    );

    const walletRow = screen.getByLabelText('Use wallet credit, ₦3,000 of ₦5,000');

    expect(() => fireEvent.press(walletRow)).not.toThrow();
    expect(onWalletToggle).not.toHaveBeenCalled();
  });

  it('renders informational wallet copy during wallet-funded bank transfer', () => {
    render(
      <WalletPayment
        colors={Colors.light}
        state={{
          ...baseState,
          infoShouldRender: true,
          shouldRender: false,
        }}
        walletBalance={3000}
        walletIsLoading={false}
      />
    );

    expect(
      screen.getByText('Wallet balance applies automatically')
    ).toBeTruthy();
    expect(
      screen.getByText('₦3,000 available now · transfer shortfall only')
    ).toBeTruthy();
  });

  it('renders the status row while wallet balance is loading', () => {
    render(
      <WalletPayment
        colors={Colors.light}
        state={{
          ...baseState,
          shouldRender: false,
          statusShouldRender: true,
        }}
        walletBalance={0}
        walletIsLoading
      />
    );

    expect(screen.getByText('Checking wallet balance')).toBeTruthy();
  });
});
