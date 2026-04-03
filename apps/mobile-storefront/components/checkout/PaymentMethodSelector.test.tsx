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
    expect(
      screen.queryByText(/5% processing fee may apply/i)
    ).toBeNull();
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
    expect(screen.getByText('Split your order in to 3-6 installments')).toBeTruthy();
    expect(
      screen.getByText('Interest rates vary. Breakdown shown during Checkout')
    ).toBeTruthy();
    expect(screen.getByText('Credit Direct')).toBeTruthy();
    expect(screen.getByText('CredPal')).toBeTruthy();
    expect(
      screen.getByText('Salary Earners and Business Owners')
    ).toBeTruthy();
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
});
