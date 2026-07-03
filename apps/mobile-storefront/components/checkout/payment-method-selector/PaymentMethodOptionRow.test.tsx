import { fireEvent, render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import { PaymentMethodOptionRow } from './PaymentMethodOptionRow';

jest.mock('expo-image', () => ({
  Image: () => null,
}));

describe('PaymentMethodOptionRow', () => {
  const method = {
    description: 'Visa, Mastercard, Verve',
    icon: 'card-outline' as const,
    id: 'paystack' as const,
    label: 'Pay with Card',
    tab: 'full' as const,
  };

  it('renders label and description for an enabled method', () => {
    render(
      <PaymentMethodOptionRow
        colors={Colors.light}
        isDisabled={false}
        isSelected={false}
        method={method}
        onPress={() => {}}
      />
    );

    expect(screen.getByText('Pay with Card')).toBeTruthy();
    expect(screen.getByText('Visa, Mastercard, Verve')).toBeTruthy();
  });

  it('calls onPress with the method id when selected', () => {
    const onPress = jest.fn();

    render(
      <PaymentMethodOptionRow
        colors={Colors.light}
        isDisabled={false}
        isSelected={false}
        method={method}
        onPress={onPress}
      />
    );

    fireEvent.press(
      screen.getByLabelText('Pay with Card. Visa, Mastercard, Verve')
    );
    expect(onPress).toHaveBeenCalledWith('paystack');
  });

  it('uses disabled reason in accessibility label and blocks press', () => {
    const onPress = jest.fn();

    render(
      <PaymentMethodOptionRow
        colors={Colors.light}
        isDisabled
        isSelected={false}
        method={{ ...method, disabledReason: 'Unavailable right now' }}
        onPress={onPress}
      />
    );

    expect(
      screen.getByLabelText('Pay with Card. Unavailable right now')
    ).toBeTruthy();
    fireEvent.press(
      screen.getByLabelText('Pay with Card. Unavailable right now')
    );
    expect(onPress).not.toHaveBeenCalled();
  });

  it('falls back to the description when disabled without a reason', () => {
    // Wallet/savings suppression disables a gateway row without setting a
    // disabledReason — the row must not show/announce the literal "undefined".
    render(
      <PaymentMethodOptionRow
        colors={Colors.light}
        isDisabled
        isSelected={false}
        method={method}
        onPress={() => {}}
      />
    );

    expect(
      screen.getByLabelText('Pay with Card. Visa, Mastercard, Verve')
    ).toBeTruthy();
    expect(screen.queryByText('undefined')).toBeNull();
  });
});
