import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import Colors from '@/constants/Colors';
import { StickyBottomActions } from './StickyBottomActions';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
  },
}));

jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');

  return {
    __esModule: true,
    default: { View },
    View,
    LinearTransition: {
      springify: () => ({
        damping: () => ({
          stiffness: () => ({}),
        }),
      }),
    },
  };
});

const defaultProps = {
  quantityInCart: 0,
  localQty: '1',
  onLocalQtyChange: jest.fn(),
  onLocalQtyBlur: jest.fn(),
  onDecrement: jest.fn(),
  onIncrement: jest.fn(),
  onAddToCart: jest.fn(),
  colors: Colors.light,
  paddingBottom: 16,
} as const;

describe('StickyBottomActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the add to cart CTA with stable row layout styles', () => {
    render(<StickyBottomActions {...defaultProps} />);

    const addToCartButton = screen.getByRole('button', { name: 'Add to Cart' });
    const flattenedStyle = StyleSheet.flatten(addToCartButton.props.style);

    expect(typeof addToCartButton.props.style).not.toBe('function');
    expect(flattenedStyle).toMatchObject({
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
    });
  });

  it('calls onAddToCart when the add to cart CTA is pressed', () => {
    render(<StickyBottomActions {...defaultProps} />);

    fireEvent.press(screen.getByRole('button', { name: 'Add to Cart' }));

    expect(defaultProps.onAddToCart).toHaveBeenCalledTimes(1);
  });

  it('renders the active cart CTA with a stable view cart button layout', () => {
    render(
      <StickyBottomActions {...defaultProps} quantityInCart={2} localQty="2" />
    );

    const viewCartButton = screen.getByRole('button', { name: 'View Cart' });
    const flattenedStyle = StyleSheet.flatten(viewCartButton.props.style);

    expect(typeof viewCartButton.props.style).not.toBe('function');
    expect(flattenedStyle).toMatchObject({
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
    });
  });

  it('navigates to cart when the view cart CTA is pressed', () => {
    render(
      <StickyBottomActions {...defaultProps} quantityInCart={1} localQty="1" />
    );

    fireEvent.press(screen.getByRole('button', { name: 'View Cart' }));

    expect(mockPush).toHaveBeenCalledWith('/(tabs)/cart');
  });
});
