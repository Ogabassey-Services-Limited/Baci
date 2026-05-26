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

    expect(screen.getByText('Minimum order: ₦7,500')).toBeTruthy();

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

    expect(
      screen.getByText('Wallet credit cannot be combined with Klump')
    ).toBeTruthy();

    fireEvent.press(klumpRow);

    expect(onSelectMethod).not.toHaveBeenCalled();
  });

  it('disables Klump when device savings credit is already active', () => {
    const onSelectMethod = jest.fn();

    render(
      <PaymentMethodSelector
        selectedMethod={'klump' as PaymentMethodType}
        onSelectMethod={onSelectMethod}
        selectedTab="installments"
        onSelectTab={() => {}}
        orderTotal={120000}
        enabledMethods={['klump' as PaymentMethodType]}
        savingsSelection={{
          use: true,
          goalId: '123e4567-e89b-12d3-a456-426614174555',
          amount: 5000,
        }}
      />
    );

    const klumpRow = screen.getByLabelText(
      'Klump. Device savings cannot be combined with Klump'
    );

    expect(
      screen.getByText('Device savings cannot be combined with Klump')
    ).toBeTruthy();

    fireEvent.press(klumpRow);

    expect(onSelectMethod).not.toHaveBeenCalled();
  });

  it('can show Paystack as an unselected alternate card option when a saved card owns the selection', () => {
    const onSelectMethod = jest.fn();

    render(
      <PaymentMethodSelector
        selectedMethod={'paystack' as PaymentMethodType}
        onSelectMethod={onSelectMethod}
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

    fireEvent.press(alternateCard);

    expect(onSelectMethod).toHaveBeenCalledWith('paystack');
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
});
