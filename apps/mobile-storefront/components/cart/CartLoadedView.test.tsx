import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ComponentProps } from 'react';
import Colors from '@/constants/Colors';
import type { CartItem } from '@/stores/cart-store';
import CartLoadedView from './CartLoadedView';

jest.mock('@/components/ui/SafeImage', () => ({
  SafeImage: function MockSafeImage() {
    return null;
  },
}));

jest.mock('@/components/storefront/GadgetPattern', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    GadgetPattern: () => <Text>GadgetPattern</Text>,
  };
});

jest.mock('@/components/checkout/checkout-identity', () => ({
  CheckoutIdentityModal: function MockCheckoutIdentityModal() {
    return null;
  },
}));

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

const item: CartItem = {
  id: 'cart-1',
  product_id: 'product-1',
  slug: 'iphone-13-pro',
  name: 'iPhone 13 Pro',
  price: 500000,
  quantity: 1,
  condition: 'NEW',
};

const formatPrice = (amount: number) =>
  `₦${new Intl.NumberFormat('en-NG').format(amount)}`;

function renderView(
  overrides: Partial<ComponentProps<typeof CartLoadedView>> = {}
) {
  const props: ComponentProps<typeof CartLoadedView> = {
    colors: Colors.light,
    colorScheme: 'light',
    enableNegotiationModal: true,
    formatPrice,
    grandTotal: item.price,
    handleCheckout: jest.fn(),
    handleClearCart: jest.fn(),
    handleQuantityChange: jest.fn(),
    handleRemoveItem: jest.fn(),
    insetsTop: 16,
    isIdentityModalOpen: false,
    itemCount: 1,
    items: [item],
    onBulkNegotiate: jest.fn(),
    onCloseIdentityModal: jest.fn(),
    onCloseNegotiateWarning: jest.fn(),
    onNegotiateItem: jest.fn(),
    onNegotiateTotal: jest.fn(),
    onOpenItemNegotiation: jest.fn(),
    pendingNegotiateItem: null,
    removeClippedSubviews: false,
    showNegotiateWarning: false,
    toggleAssurance: jest.fn(),
    triggerHaptic: jest.fn(),
    updateQuantity: jest.fn(),
    ...overrides,
  };

  return { props, ...render(<CartLoadedView {...props} />) };
}

describe('CartLoadedView', () => {
  it('exposes clear-cart and checkout actions with their current values', () => {
    const handleClearCart = jest.fn();
    const handleCheckout = jest.fn();

    renderView({ handleClearCart, handleCheckout });

    fireEvent.press(screen.getByRole('button', { name: 'Clear cart' }));
    fireEvent.press(
      screen.getByRole('button', {
        name: `Proceed to checkout, total ${formatPrice(item.price)}`,
      })
    );

    expect(handleClearCart).toHaveBeenCalledTimes(1);
    expect(handleCheckout).toHaveBeenCalledTimes(1);
  });

  it('delegates total negotiation from the footer action', () => {
    const onNegotiateTotal = jest.fn();

    renderView({ onNegotiateTotal });

    fireEvent.press(
      screen.getByRole('button', { name: 'Negotiate cart total' })
    );

    expect(onNegotiateTotal).toHaveBeenCalledTimes(1);
  });

  it('delegates modal bulk negotiation separately from the footer action', () => {
    const onBulkNegotiate = jest.fn();
    const onNegotiateTotal = jest.fn();

    renderView({
      onBulkNegotiate,
      onNegotiateTotal,
      showNegotiateWarning: true,
    });

    fireEvent.press(screen.getByText('Bulk Negotiate Entire Cart'));

    expect(onBulkNegotiate).toHaveBeenCalledTimes(1);
    expect(onNegotiateTotal).not.toHaveBeenCalled();
  });
});
