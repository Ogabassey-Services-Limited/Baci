import { fireEvent, render, screen } from '@testing-library/react-native';
import {
  PaymentMethodSelector,
  type PaymentMethodType,
} from './PaymentMethodSelector';

jest.mock('expo-image', () => ({
  Image: () => null,
}));

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'dark',
}));

describe('PaymentMethodSelector', () => {
  it('shows the Lagos availability note for pay on delivery without the removed fee copy', () => {
    render(
      <PaymentMethodSelector
        selectedMethod={'pay_on_delivery' as PaymentMethodType}
        onSelectMethod={() => {}}
        selectedTab="full"
        onSelectTab={() => {}}
        orderTotal={120000}
      />
    );

    expect(screen.getByText('Available in Lagos only.')).toBeTruthy();
    expect(screen.queryByText(/5% processing fee may apply/i)).toBeNull();
  });

  it('shows reordered installment providers with the requested messaging', () => {
    render(
      <PaymentMethodSelector
        selectedMethod={'credit_direct' as PaymentMethodType}
        onSelectMethod={() => {}}
        selectedTab="installments"
        onSelectTab={() => {}}
        orderTotal={120000}
      />
    );

    expect(screen.getByText('Buy Now Pay Later')).toBeTruthy();
    expect(
      screen.getByText('Split your order into 3-6 installments')
    ).toBeTruthy();
    expect(
      screen.getByText('Interest rates vary. Breakdown shown during Checkout')
    ).toBeTruthy();
    expect(screen.getByText('Credit Direct')).toBeTruthy();
    expect(screen.getByText('CredPal')).toBeTruthy();
    expect(screen.getByText('Salary Earners and Business Owners')).toBeTruthy();
    expect(screen.getByText('Salary Earners Only')).toBeTruthy();
  });

  it('exposes the pay later tab with invoice and pay for me options', () => {
    const onSelectTab = jest.fn();

    render(
      <PaymentMethodSelector
        selectedMethod={'invoice' as PaymentMethodType}
        onSelectMethod={() => {}}
        selectedTab="pay_later"
        onSelectTab={onSelectTab}
        orderTotal={120000}
      />
    );

    expect(screen.getByText('Generate Invoice')).toBeTruthy();
    expect(screen.getByText('Pay for Me')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Pay later'));
    expect(onSelectTab).toHaveBeenCalledWith('pay_later');
  });

  it('hides the installments tab when no BNPL methods are enabled', () => {
    render(
      <PaymentMethodSelector
        selectedMethod={'invoice' as PaymentMethodType}
        onSelectMethod={() => {}}
        selectedTab="pay_later"
        onSelectTab={() => {}}
        orderTotal={120000}
        enabledMethods={['invoice', 'payforme']}
      />
    );

    expect(screen.queryByLabelText('Pay in installments')).toBeNull();
    expect(screen.getByLabelText('Pay later')).toBeTruthy();
  });

  it('keeps the installments tab visible when Klump is the only enabled BNPL provider', () => {
    render(
      <PaymentMethodSelector
        selectedMethod={'klump' as PaymentMethodType}
        onSelectMethod={() => {}}
        selectedTab="installments"
        onSelectTab={() => {}}
        orderTotal={120000}
        enabledMethods={['klump' as PaymentMethodType]}
      />
    );

    expect(screen.getByLabelText('Pay in installments')).toBeTruthy();
    expect(screen.getByText('Klump')).toBeTruthy();
  });

  it('uses caller-supplied Klump disabled reasons for wallet and merchant range boundaries', () => {
    const onSelectMethod = jest.fn();
    const klumpDisabledProps = {
      methodDisabledReasons: {
        klump: 'Minimum order: ₦7,500',
      },
    } as Record<string, unknown>;

    render(
      <PaymentMethodSelector
        selectedMethod={'klump' as PaymentMethodType}
        onSelectMethod={onSelectMethod}
        selectedTab="installments"
        onSelectTab={() => {}}
        orderTotal={5000}
        enabledMethods={['klump' as PaymentMethodType]}
        {...klumpDisabledProps}
      />
    );

    const klumpRow = screen.getByLabelText('Klump. Minimum order: ₦7,500');

    expect(klumpRow.props.accessibilityState).toMatchObject({
      disabled: true,
    });

    fireEvent.press(klumpRow);

    expect(onSelectMethod).not.toHaveBeenCalled();
  });

  it('disables Klump when wallet credit is already active', () => {
    const onSelectMethod = jest.fn();

    render(
      <PaymentMethodSelector
        selectedMethod={'klump' as PaymentMethodType}
        onSelectMethod={onSelectMethod}
        selectedTab="installments"
        onSelectTab={() => {}}
        orderTotal={120000}
        enabledMethods={['klump' as PaymentMethodType]}
        walletSelection={{ use: true, amount: 5000 }}
      />
    );

    const klumpRow = screen.getByLabelText(
      'Klump. Wallet credit cannot be combined with Klump'
    );

    expect(klumpRow.props.accessibilityState).toMatchObject({
      disabled: true,
    });

    fireEvent.press(klumpRow);

    expect(onSelectMethod).not.toHaveBeenCalled();
  });

  it('can show Paystack as an unselected alternate card option when a saved card owns the selection', () => {
    render(
      <PaymentMethodSelector
        selectedMethod={'paystack' as PaymentMethodType}
        onSelectMethod={() => {}}
        selectedTab="full"
        onSelectTab={() => {}}
        orderTotal={1000}
        enabledMethods={['paystack']}
        suppressedSelectedMethods={['paystack']}
        methodLabelOverrides={{ paystack: 'Use another card' }}
      />
    );

    const alternateCard = screen.getByLabelText(
      'Use another card. Visa, Mastercard, Verve'
    );

    expect(screen.queryByText('Pay with Card')).toBeNull();
    expect(alternateCard.props.accessibilityState).toMatchObject({
      checked: false,
      disabled: false,
    });
  });

  it('applies payment method description and badge overrides', () => {
    render(
      <PaymentMethodSelector
        selectedMethod={'paystack' as PaymentMethodType}
        onSelectMethod={() => {}}
        selectedTab="full"
        onSelectTab={() => {}}
        orderTotal={1000}
        enabledMethods={['paystack', 'bank_transfer']}
        methodDescriptionOverrides={{
          paystack: '2x cashback on your first card payment',
        }}
        methodBadgeOverrides={{ paystack: '2x cashback' }}
      />
    );

    expect(screen.getByText('Pay with Card')).toBeTruthy();
    expect(
      screen.getByText('2x cashback on your first card payment')
    ).toBeTruthy();
    expect(screen.getByText('2x cashback')).toBeTruthy();
    expect(screen.getByText('Bank Transfer')).toBeTruthy();
  });

  describe('wallet payment row', () => {
    // Storefront checkout opts in via walletMode='orders'. VTU's
    // UtilityPaymentOptions caller intentionally omits the prop (defaults
    // to 'off') until PR B's server support exists, so the wallet row
    // stays hidden in VTU until that lands. The hook call (useWallet)
    // lives in the parent — the selector is presentation-only and
    // receives `walletBalance` as a prop.

    it('renders nothing wallet-related when walletMode is off (default — regression-pin for VTU)', () => {
      render(
        <PaymentMethodSelector
          selectedMethod={'paystack' as PaymentMethodType}
          onSelectMethod={() => {}}
          selectedTab="full"
          onSelectTab={() => {}}
          orderTotal={1000}
          walletBalance={800}
          walletOrderTotal={1000}
        />
      );

      expect(screen.queryByLabelText(/wallet/i)).toBeNull();
      expect(screen.queryByText(/wallet credit/i)).toBeNull();
    });

    it('renders nothing wallet-related when walletMode is orders but balance is 0', () => {
      render(
        <PaymentMethodSelector
          selectedMethod={'paystack' as PaymentMethodType}
          onSelectMethod={() => {}}
          selectedTab="full"
          onSelectTab={() => {}}
          orderTotal={1000}
          walletMode="orders"
          walletBalance={0}
          walletOrderTotal={1000}
        />
      );

      expect(screen.queryByLabelText(/wallet/i)).toBeNull();
    });

    it('renders the wallet row in partial-deductible mode when balance < orderTotal', () => {
      render(
        <PaymentMethodSelector
          selectedMethod={'paystack' as PaymentMethodType}
          onSelectMethod={() => {}}
          selectedTab="full"
          onSelectTab={() => {}}
          orderTotal={1000}
          walletMode="orders"
          walletBalance={800}
          walletOrderTotal={1000}
        />
      );

      // Wallet row exposes its balance and the partial-deductible affordance
      // so the user can see how much will be charged to the card.
      expect(screen.getByLabelText(/use wallet credit/i)).toBeTruthy();
      expect(screen.getByText(/₦800/)).toBeTruthy();
      expect(screen.getByText(/₦200/)).toBeTruthy(); // residual to card
    });

    it('renders the wallet row in full-coverage mode when balance >= orderTotal', () => {
      render(
        <PaymentMethodSelector
          selectedMethod={'paystack' as PaymentMethodType}
          onSelectMethod={() => {}}
          selectedTab="full"
          onSelectTab={() => {}}
          orderTotal={1000}
          walletMode="orders"
          walletBalance={1500}
          walletOrderTotal={1000}
        />
      );

      // Full coverage variant: wallet covers entire order, no card needed
      // for this transaction. UI should make that explicit.
      expect(screen.getByLabelText(/pay with wallet/i)).toBeTruthy();
      expect(screen.getByText(/₦1,500/)).toBeTruthy();
    });

    it('emits walletSelection with use=true and amount=balance when partial wallet is toggled on', () => {
      const onWalletToggle = jest.fn();

      render(
        <PaymentMethodSelector
          selectedMethod={'paystack' as PaymentMethodType}
          onSelectMethod={() => {}}
          selectedTab="full"
          onSelectTab={() => {}}
          orderTotal={1000}
          walletMode="orders"
          walletBalance={800}
          walletOrderTotal={1000}
          onWalletToggle={onWalletToggle}
        />
      );

      fireEvent.press(screen.getByLabelText(/use wallet credit/i));

      expect(onWalletToggle).toHaveBeenCalledWith({ use: true, amount: 800 });
    });

    it('emits walletSelection with use=true and amount=orderTotal when wallet covers in full', () => {
      const onWalletToggle = jest.fn();

      render(
        <PaymentMethodSelector
          selectedMethod={'paystack' as PaymentMethodType}
          onSelectMethod={() => {}}
          selectedTab="full"
          onSelectTab={() => {}}
          orderTotal={1000}
          walletMode="orders"
          walletBalance={1500}
          walletOrderTotal={1000}
          onWalletToggle={onWalletToggle}
        />
      );

      fireEvent.press(screen.getByLabelText(/pay with wallet/i));

      expect(onWalletToggle).toHaveBeenCalledWith({ use: true, amount: 1000 });
    });

    it('hides the wallet row when the BNPL tab is selected (installments)', () => {
      // The BNPL branch in checkout.tsx returns early without spreading
      // buildWalletOrderFields, so a wallet selection there would be
      // silently dropped. Hide the toggle so the user never sees a
      // selection that won't be honored.
      render(
        <PaymentMethodSelector
          selectedMethod={'credit_direct' as PaymentMethodType}
          onSelectMethod={() => {}}
          selectedTab="installments"
          onSelectTab={() => {}}
          orderTotal={120000}
          walletMode="orders"
          walletBalance={5000}
          walletOrderTotal={120000}
        />
      );

      expect(screen.queryByLabelText(/wallet/i)).toBeNull();
    });

    it('hides the wallet row when the pay_later tab is selected', () => {
      render(
        <PaymentMethodSelector
          selectedMethod={'invoice' as PaymentMethodType}
          onSelectMethod={() => {}}
          selectedTab="pay_later"
          onSelectTab={() => {}}
          orderTotal={5000}
          walletMode="orders"
          walletBalance={5000}
          walletOrderTotal={5000}
        />
      );

      expect(screen.queryByLabelText(/wallet/i)).toBeNull();
    });

    it.each([
      'pay_on_delivery',
      'juicyway',
    ] as const)('hides the wallet row for %s (no real-time settlement of residual)', (method) => {
      render(
        <PaymentMethodSelector
          selectedMethod={method as PaymentMethodType}
          onSelectMethod={() => {}}
          selectedTab="full"
          onSelectTab={() => {}}
          orderTotal={5000}
          walletMode="orders"
          walletBalance={3000}
          walletOrderTotal={5000}
        />
      );

      expect(screen.queryByLabelText(/wallet/i)).toBeNull();
    });

    it.each([
      'paystack',
      'korapay',
      'bank_transfer',
    ] as const)('shows the wallet row for %s (gateway can settle the residual)', (method) => {
      render(
        <PaymentMethodSelector
          selectedMethod={method as PaymentMethodType}
          onSelectMethod={() => {}}
          selectedTab="full"
          onSelectTab={() => {}}
          orderTotal={5000}
          walletMode="orders"
          walletBalance={3000}
          walletOrderTotal={5000}
        />
      );

      expect(screen.getByLabelText(/use wallet credit/i)).toBeTruthy();
    });

    it('suppresses the active-radio visual on gateway rows when wallet fully covers and is active', () => {
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
          onSelectMethod={() => {}}
          selectedTab="full"
          onSelectTab={() => {}}
          orderTotal={1000}
          walletMode="orders"
          walletBalance={1500}
          walletOrderTotal={1000}
          walletSelection={{ use: true, amount: 1000 }}
          onWalletToggle={() => {}}
        />
      );

      const paystackRow = screen.getByLabelText(/Pay with Card/i);
      // Gateway row is no longer the active selection while wallet
      // covers fully and is selected.
      expect(paystackRow.props.accessibilityState.checked).toBe(false);
      expect(paystackRow.props.accessibilityState.disabled).toBe(true);
    });

    it('emits walletSelection with use=false when toggled off', () => {
      const onWalletToggle = jest.fn();

      render(
        <PaymentMethodSelector
          selectedMethod={'paystack' as PaymentMethodType}
          onSelectMethod={() => {}}
          selectedTab="full"
          onSelectTab={() => {}}
          orderTotal={1000}
          walletMode="orders"
          walletBalance={800}
          walletOrderTotal={1000}
          walletSelection={{ use: true, amount: 800 }}
          onWalletToggle={onWalletToggle}
        />
      );

      fireEvent.press(screen.getByLabelText(/use wallet credit/i));

      expect(onWalletToggle).toHaveBeenCalledWith({ use: false, amount: 0 });
    });
  });
});
