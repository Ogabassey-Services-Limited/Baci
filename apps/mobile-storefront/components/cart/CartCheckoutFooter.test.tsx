import { fireEvent, render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import CartCheckoutFooter from './CartCheckoutFooter';

jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');

  return {
    __esModule: true,
    default: { View },
    View,
    cancelAnimation: jest.fn(),
    useAnimatedStyle: (updater: () => object) => updater(),
    useSharedValue: (value: number) => ({ value }),
    withRepeat: (value: number) => value,
    withTiming: (value: number) => value,
  };
});

const formatPrice = (amount: number) => `NGN ${amount.toLocaleString()}`;

describe('CartCheckoutFooter', () => {
  it('exposes checkout and total negotiation actions', () => {
    const onCheckout = jest.fn();
    const onNegotiateTotal = jest.fn();

    render(
      <CartCheckoutFooter
        checkoutDotColor="#fff"
        colors={Colors.light}
        enableNegotiationModal
        formatPrice={formatPrice}
        grandTotal={500000}
        hasAcceptedNegotiation={false}
        onCheckout={onCheckout}
        onNegotiateTotal={onNegotiateTotal}
        surfaceInset={Colors.light.background}
      />
    );

    fireEvent.press(screen.getByRole('button', { name: 'Negotiate cart total' }));
    fireEvent.press(
      screen.getByRole('button', {
        name: `Proceed to checkout, total ${formatPrice(500000)}`,
      })
    );

    expect(onNegotiateTotal).toHaveBeenCalledTimes(1);
    expect(onCheckout).toHaveBeenCalledTimes(1);
  });

  it('hides cart negotiation when the template does not enable it', () => {
    render(
      <CartCheckoutFooter
        checkoutDotColor="#fff"
        colors={Colors.light}
        enableNegotiationModal={false}
        formatPrice={formatPrice}
        grandTotal={500000}
        hasAcceptedNegotiation={false}
        onCheckout={jest.fn()}
        onNegotiateTotal={jest.fn()}
        surfaceInset={Colors.light.background}
      />
    );

    expect(
      screen.queryByRole('button', { name: 'Negotiate cart total' })
    ).toBeNull();
  });

  it('keeps accepted-negotiation presses delegated to route policy', () => {
    const onNegotiateTotal = jest.fn();

    render(
      <CartCheckoutFooter
        checkoutDotColor="#fff"
        colors={Colors.light}
        enableNegotiationModal
        formatPrice={formatPrice}
        grandTotal={500000}
        hasAcceptedNegotiation
        onCheckout={jest.fn()}
        onNegotiateTotal={onNegotiateTotal}
        surfaceInset={Colors.light.background}
      />
    );

    fireEvent.press(screen.getByRole('button', { name: 'Negotiate cart total' }));
    expect(onNegotiateTotal).toHaveBeenCalledTimes(1);
  });
});
