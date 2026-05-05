import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import CartScreen from '@/app/(tabs)/cart';
import Colors from '@/constants/Colors';

type MockAuthStatus = {
  customer: null;
  isAuthenticated: boolean;
  isGuest: boolean;
  isInitialized: boolean;
  isLoading: boolean;
  user: { id: string } | null;
};

const mockOpenNegotiation = jest.fn();
const mockUseColorScheme = jest.fn(() => 'dark');
const mockRouterPush = jest.fn();
const buildAuthStatus = (
  overrides: Partial<MockAuthStatus> = {}
): MockAuthStatus => ({
  customer: null,
  isAuthenticated: false,
  isGuest: true,
  isInitialized: true,
  isLoading: false,
  user: null,
  ...overrides,
});
const mockUseAuthStatus = jest.fn((): MockAuthStatus => buildAuthStatus());

jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockRouterPush(...args),
  },
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
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

jest.mock('@/components/checkout/checkout-identity', () => {
  const { Text: MockText } = jest.requireActual('react-native');

  return ({
  CheckoutIdentityModal: ({ isOpen }: { isOpen: boolean }) => {
    if (!isOpen) return null;
    return <MockText>Checkout Identity Modal</MockText>;
  },
  });
});

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

jest.mock('@/hooks/use-auth-guard', () => ({
  useAuthStatus: () => mockUseAuthStatus(),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    top: 16,
    right: 0,
    bottom: 0,
    left: 0,
  }),
}));

jest.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { openNegotiation: typeof mockOpenNegotiation }) => unknown) =>
    selector({ openNegotiation: mockOpenNegotiation }),
}));

describe('CartScreen theming', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseColorScheme.mockReturnValue('dark');
    mockUseAuthStatus.mockReturnValue(buildAuthStatus());
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
    mockUseAuthStatus.mockReturnValue(buildAuthStatus());
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

  it('opens guest identity modal for guests and routes signed-in users straight to checkout', () => {
    const { rerender } = render(<CartScreen />);

    fireEvent.press(
      screen.getByRole('button', { name: /Proceed to checkout, total/i })
    );

    expect(screen.getByText('Checkout Identity Modal')).toBeTruthy();
    expect(mockRouterPush).not.toHaveBeenCalled();

    mockUseAuthStatus.mockReturnValue(
      buildAuthStatus({
        isAuthenticated: true,
        isGuest: false,
        user: { id: 'user-1' },
      })
    );

    rerender(<CartScreen />);
    fireEvent.press(
      screen.getByRole('button', { name: /Proceed to checkout, total/i })
    );

    expect(mockRouterPush).toHaveBeenCalledWith('/checkout');
  });
});
