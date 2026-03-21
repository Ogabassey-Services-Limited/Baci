import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import Colors from '@/constants/Colors';
import CartScreen from './cart';

const mockOpenNegotiation = jest.fn();
const mockUseColorScheme = jest.fn(() => 'dark');

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}));

jest.mock('zustand/react/shallow', () => ({
  useShallow: <T,>(selector: T) => selector,
}));

jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');

  const makeSharedValue = (value: number) => {
    let current = value;
    return {
      get: () => current,
      set: (next: number) => {
        current = next;
      },
    };
  };

  return {
    __esModule: true,
    default: { View },
    View,
    cancelAnimation: jest.fn(),
    useAnimatedStyle: (updater: () => object) => updater(),
    useSharedValue: makeSharedValue,
    withRepeat: (value: number) => value,
    withSequence: (...values: number[]) => values.at(-1) ?? 0,
    withTiming: (value: number) => value,
  };
});

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => mockUseColorScheme(),
}));

jest.mock('@/components/checkout/checkout-identity', () => ({
  CheckoutIdentityModal: () => null,
}));

jest.mock('@/components/ui/SafeImage', () => ({
  SafeImage: function MockSafeImage() {
    return null;
  },
}));

const createMockCartState = (overrides: Record<string, unknown> = {}) => ({
  items: [
    {
      id: 'cart-1',
      product_id: 'product-1',
      slug: 'lenovo-thinkpad-e16-gen-2',
      name: 'Lenovo ThinkPad E16 Gen 2',
      price: 1428000,
      quantity: 1,
      image_url: 'https://example.com/lenovo.jpg',
      condition: 'NEW',
      hasAssurance: false,
      assuranceRate: 0.05,
    },
  ],
  itemCount: () => 1,
  subtotal: () => 1428000,
  updateQuantity: jest.fn(),
  removeItem: jest.fn(),
  clearCart: jest.fn(),
  toggleAssurance: jest.fn(),
  ...overrides,
});

let mockCartState: Record<string, unknown> = createMockCartState();

jest.mock('@/stores/cart-store', () => ({
  formatPrice: (value: number) =>
    `₦${new Intl.NumberFormat('en-NG').format(value)}`,
  useCartStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector(mockCartState),
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: (selector: (state: { session: null }) => unknown) =>
    selector({ session: null }),
}));

jest.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { openNegotiation: typeof mockOpenNegotiation }) => unknown) =>
    selector({ openNegotiation: mockOpenNegotiation }),
}));

describe('CartScreen theming', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseColorScheme.mockReturnValue('dark');
    mockCartState = createMockCartState();
  });

  // These assertions intentionally pin design-system token usage so the cart
  // stays readable in each theme. Update them only if the accessibility contract
  // or theme tokens change.
  it('renders readable dark mode cart content', () => {
    render(<CartScreen />);

    expect(
      StyleSheet.flatten(screen.getByText('Lenovo ThinkPad E16 Gen 2').props.style)
    ).toMatchObject({ color: Colors.dark.text });
    expect(
      StyleSheet.flatten(screen.getByText('Device Protection (+5%)').props.style)
    ).toMatchObject({ color: Colors.dark.textSecondary });
    expect(
      StyleSheet.flatten(screen.getByText('Secure Checkout').props.style)
    ).toMatchObject({ color: Colors.dark.textSecondary });
  });

  // These assertions intentionally pin design-system token usage so the cart
  // stays readable in each theme. Update them only if the accessibility contract
  // or theme tokens change.
  it('keeps light mode readable too', () => {
    mockUseColorScheme.mockReturnValue('light');

    render(<CartScreen />);

    expect(
      StyleSheet.flatten(screen.getByText('Lenovo ThinkPad E16 Gen 2').props.style)
    ).toMatchObject({ color: Colors.light.text });
    expect(
      StyleSheet.flatten(screen.getByText('Device Protection (+5%)').props.style)
    ).toMatchObject({ color: Colors.light.textSecondary });
  });
});

describe('CartScreen state', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseColorScheme.mockReturnValue('dark');
    mockCartState = createMockCartState();
  });

  it('renders empty cart state when there are no cart items', () => {
    mockCartState = createMockCartState({
      items: [],
      itemCount: () => 0,
      subtotal: () => 0,
    });

    render(<CartScreen />);

    expect(screen.getByText('Your cart is empty 🛒')).toBeTruthy();
    expect(screen.getByText('Start Shopping')).toBeTruthy();
    expect(screen.queryByText('Lenovo ThinkPad E16 Gen 2')).toBeNull();
  });

  it('renders cart error state when cart data is unavailable', () => {
    mockCartState = {
      items: undefined,
      itemCount: undefined,
      subtotal: undefined,
      updateQuantity: undefined,
      removeItem: undefined,
      clearCart: undefined,
      toggleAssurance: undefined,
    };

    render(<CartScreen />);

    expect(screen.getByText('Unable to load cart')).toBeTruthy();
    expect(screen.getByText('Retry')).toBeTruthy();
    expect(screen.queryByText('Lenovo ThinkPad E16 Gen 2')).toBeNull();
  });
});
