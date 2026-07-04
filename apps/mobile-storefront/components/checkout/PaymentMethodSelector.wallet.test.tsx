import { jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import {
  PaymentMethodSelector,
  type PaymentMethodType,
} from './PaymentMethodSelector';

let mockColorScheme: 'dark' | 'light' = 'dark';

jest.mock('expo-image', () => ({
  Image: () => null,
}));

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => mockColorScheme,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const noop = () => undefined;

function queryWalletControl() {
  return (
    screen.queryByRole('button', { name: /wallet/i }) ??
    screen.queryByRole('checkbox', { name: /wallet/i }) ??
    screen.queryByRole('radio', { name: /wallet/i })
  );
}

function getPartialWalletControl() {
  return screen.getByRole('checkbox', { name: /use wallet credit/i });
}

function getFullWalletControl() {
  return screen.getByRole('radio', { name: /pay with wallet/i });
}

describe('PaymentMethodSelector', () => {
  beforeEach(() => {
    mockColorScheme = 'dark';
  });

  describe('wallet payment row', () => {
    // VTU intentionally omits walletMode until its server support exists.

    it('renders nothing wallet-related when walletMode is off (default — regression-pin for VTU)', () => {
      render(
        <PaymentMethodSelector
          selectedMethod={'paystack' as PaymentMethodType}
          onSelectMethod={noop}
          selectedTab="full"
          onSelectTab={noop}
          orderTotal={1000}
          walletBalance={800}
          walletOrderTotal={1000}
        />
      );

      expect(queryWalletControl()).toBeNull();
      expect(
        screen.queryByRole('button', { name: /wallet credit/i })
      ).toBeNull();
    });

    it('renders nothing wallet-related when walletMode is orders but balance is 0', () => {
      render(
        <PaymentMethodSelector
          selectedMethod={'paystack' as PaymentMethodType}
          onSelectMethod={noop}
          selectedTab="full"
          onSelectTab={noop}
          orderTotal={1000}
          walletMode="orders"
          walletBalance={0}
          walletOrderTotal={1000}
        />
      );

      expect(queryWalletControl()).toBeNull();
    });

    it('renders the wallet row in partial-deductible mode when balance < orderTotal', () => {
      mockColorScheme = 'light';

      render(
        <PaymentMethodSelector
          selectedMethod={'paystack' as PaymentMethodType}
          onSelectMethod={noop}
          selectedTab="full"
          onSelectTab={noop}
          orderTotal={1000}
          walletMode="orders"
          walletBalance={800}
          walletOrderTotal={1000}
        />
      );

      // Wallet row exposes its balance and the partial-deductible affordance
      // so the user can see how much will be charged to the card.
      expect(getPartialWalletControl()).toBeTruthy();
      expect(screen.getByText(/₦800/)).toBeTruthy();
      expect(screen.getByText(/₦200/)).toBeTruthy(); // residual to card
    });

    it('renders the wallet row in full-coverage mode when balance >= orderTotal', () => {
      render(
        <PaymentMethodSelector
          selectedMethod={'paystack' as PaymentMethodType}
          onSelectMethod={noop}
          selectedTab="full"
          onSelectTab={noop}
          orderTotal={1000}
          walletMode="orders"
          walletBalance={1500}
          walletOrderTotal={1000}
        />
      );

      // Full coverage variant: wallet covers entire order, no card needed
      // for this transaction. UI should make that explicit.
      expect(getFullWalletControl()).toBeTruthy();
      expect(screen.getByText(/₦1,500/)).toBeTruthy();
    });

    it('keeps wallet payment CTA visible when wallet balance is sufficient', () => {
      render(
        <PaymentMethodSelector
          selectedMethod={'paystack' as PaymentMethodType}
          onSelectMethod={() => {}}
          selectedTab="full"
          onSelectTab={() => {}}
          orderTotal={15000}
          walletMode="orders"
          walletBalance={20000}
          walletOrderTotal={15000}
        />
      );

      const walletControl =
        screen.queryByRole('radio', { name: /pay with wallet/i }) ??
        screen.queryByRole('checkbox', { name: /use wallet credit/i });

      expect(walletControl).toBeTruthy();
    });

    it('emits walletSelection with use=true and amount=balance when partial wallet is toggled on', () => {
      const onWalletToggle = jest.fn();

      render(
        <PaymentMethodSelector
          selectedMethod={'paystack' as PaymentMethodType}
          onSelectMethod={noop}
          selectedTab="full"
          onSelectTab={noop}
          orderTotal={1000}
          walletMode="orders"
          walletBalance={800}
          walletOrderTotal={1000}
          onWalletToggle={onWalletToggle}
        />
      );

      fireEvent.press(getPartialWalletControl());

      expect(onWalletToggle).toHaveBeenCalledWith({ use: true, amount: 800 });
    });

    it('emits walletSelection with use=true and amount=orderTotal when wallet covers in full', () => {
      const onWalletToggle = jest.fn();

      render(
        <PaymentMethodSelector
          selectedMethod={'paystack' as PaymentMethodType}
          onSelectMethod={noop}
          selectedTab="full"
          onSelectTab={noop}
          orderTotal={1000}
          walletMode="orders"
          walletBalance={1500}
          walletOrderTotal={1000}
          onWalletToggle={onWalletToggle}
        />
      );

      fireEvent.press(getFullWalletControl());

      expect(onWalletToggle).toHaveBeenCalledWith({ use: true, amount: 1000 });
    });

    it('shows the wallet row when the BNPL tab is selected (installments)', () => {
      render(
        <PaymentMethodSelector
          selectedMethod={'credit_direct' as PaymentMethodType}
          onSelectMethod={noop}
          selectedTab="installments"
          onSelectTab={noop}
          orderTotal={120000}
          walletMode="orders"
          walletBalance={5000}
          walletOrderTotal={120000}
        />
      );

      expect(queryWalletControl()).toBeTruthy();
    });

    it('shows the wallet row when the pay_later tab is selected', () => {
      render(
        <PaymentMethodSelector
          selectedMethod={'invoice' as PaymentMethodType}
          onSelectMethod={noop}
          selectedTab="pay_later"
          onSelectTab={noop}
          orderTotal={5000}
          walletMode="orders"
          walletBalance={5000}
          walletOrderTotal={5000}
        />
      );

      expect(queryWalletControl()).toBeTruthy();
    });

    it.each([
      'pay_on_delivery',
      'juicyway',
    ] as const)('hides the wallet row for %s (no real-time settlement of residual)', (method) => {
      render(
        <PaymentMethodSelector
          selectedMethod={method as PaymentMethodType}
          onSelectMethod={noop}
          selectedTab="full"
          onSelectTab={noop}
          orderTotal={5000}
          walletMode="orders"
          walletBalance={3000}
          walletOrderTotal={5000}
        />
      );

      expect(queryWalletControl()).toBeNull();
    });

    it.each([
      'paystack',
      'korapay',
      'bank_transfer',
    ] as const)('shows the wallet row for %s (gateway can settle the residual)', (method) => {
      render(
        <PaymentMethodSelector
          selectedMethod={method as PaymentMethodType}
          onSelectMethod={noop}
          selectedTab="full"
          onSelectTab={noop}
          orderTotal={5000}
          walletMode="orders"
          walletBalance={3000}
          walletOrderTotal={5000}
        />
      );

      expect(getPartialWalletControl()).toBeTruthy();
    });

    it('suppresses the active-radio visual on gateway rows when wallet fully covers and is active', () => {
      const onSelectMethod = jest.fn();

      // Regression: when wallet covers the full order AND the toggle is
      // on, the gateway list becomes informational. Showing two competing
      // active radios (wallet row + gateway row) is confusing UX. The
      // gateway rows render with checked=false and disabled=true while
      // the wallet selection is active, so only the wallet row appears
      // selected. The underlying `selectedMethod` prop is preserved
      // unchanged.
      render(
        <PaymentMethodSelector
          selectedMethod={'paystack' as PaymentMethodType}
          onSelectMethod={onSelectMethod}
          selectedTab="full"
          onSelectTab={noop}
          orderTotal={1000}
          walletMode="orders"
          walletBalance={1500}
          walletOrderTotal={1000}
          walletSelection={{ use: true, amount: 1000 }}
          onWalletToggle={noop}
        />
      );

      const paystackRow = screen.getByRole('radio', { name: /Pay with Card/i });

      fireEvent.press(paystackRow);

      expect(onSelectMethod).not.toHaveBeenCalled();
    });

    it('emits walletSelection with use=false when toggled off', () => {
      const onWalletToggle = jest.fn();

      render(
        <PaymentMethodSelector
          selectedMethod={'paystack' as PaymentMethodType}
          onSelectMethod={noop}
          selectedTab="full"
          onSelectTab={noop}
          orderTotal={1000}
          walletMode="orders"
          walletBalance={800}
          walletOrderTotal={1000}
          walletSelection={{ use: true, amount: 800 }}
          onWalletToggle={onWalletToggle}
        />
      );

      fireEvent.press(getPartialWalletControl());

      expect(onWalletToggle).toHaveBeenCalledWith({ use: false, amount: 0 });
    });
  });
});
