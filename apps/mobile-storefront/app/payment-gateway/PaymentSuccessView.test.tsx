import { jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { PAYMENT_KINDS } from '@/app/payment-gateway/payment-gateway.helpers';
import Colors from '@/constants/Colors';
import { PaymentSuccessView } from './PaymentSuccessView';

const mockStackScreen = jest.fn((_props: unknown) => null);

jest.mock('expo-router', () => ({
  Stack: {
    Screen: (props: unknown) => mockStackScreen(props),
  },
}));

jest.mock('@expo/vector-icons', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } =
    jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Ionicons: (props: Record<string, unknown>) =>
      React.createElement(View, {
        accessibilityLabel:
          typeof props.accessibilityLabel === 'string'
            ? props.accessibilityLabel
            : undefined,
      }),
  };
});

describe('PaymentSuccessView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders order confirmation redirect copy by default', () => {
    render(<PaymentSuccessView colors={Colors.light} />);

    expect(screen.getByText('Payment Successful!')).toBeOnTheScreen();
    expect(
      screen.getByText('Redirecting to your order confirmation...')
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Payment successful')).toBeOnTheScreen();
  });

  it('renders utility confirmation redirect copy for VTU payments', () => {
    render(
      <PaymentSuccessView
        colors={Colors.light}
        paymentKind={PAYMENT_KINDS.VTU}
      />
    );

    expect(screen.getByText('Payment Successful!')).toBeOnTheScreen();
    expect(
      screen.getByText('Redirecting to your utility confirmation...')
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Payment successful')).toBeOnTheScreen();
  });

  it('hides the route header after payment succeeds', () => {
    render(<PaymentSuccessView colors={Colors.light} />);

    expect(mockStackScreen).toHaveBeenCalledWith({
      options: { headerShown: false },
    });
  });
});
