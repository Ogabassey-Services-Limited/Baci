import { render, screen } from '@testing-library/react-native';

// ---- Mock external dependencies ----

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'light'),
}));

const mockRouterPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: mockRouterPush },
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'Light' },
}));

jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: {
      View,
      createAnimatedComponent: (c: unknown) => c,
    },
    useSharedValue: jest.fn(() => ({ get: () => 0, set: jest.fn() })),
    useAnimatedStyle: jest.fn(() => ({})),
    withRepeat: jest.fn(),
    withSequence: jest.fn(),
    withTiming: jest.fn(),
    cancelAnimation: jest.fn(),
  };
});

jest.mock('@/components/checkout/checkout-identity', () => ({
  CheckoutIdentityModal: () => null,
}));

jest.mock('@/components/ui/SafeImage', () => ({
  SafeImage: () => null,
}));

// ---- Mock Zustand stores ----

const mockItems = [
  {
    id: 'item-1',
    product_id: 'prod-1',
    slug: 'test-product',
    name: 'Test Product',
    price: 5000,
    quantity: 2,
    image_url: 'https://example.com/img.png',
    condition: 'NEW',
    hasAssurance: false,
    assuranceRate: 0.05,
  },
];

const mockUpdateQuantity = jest.fn();
const mockRemoveItem = jest.fn();
const mockClearCart = jest.fn();
const mockToggleAssurance = jest.fn();
const mockOpenNegotiation = jest.fn();

jest.mock('@/stores/cart-store', () => ({
  useCartStore: jest.fn((selector: (state: unknown) => unknown) => {
    const state = {
      items: mockItems,
      itemCount: () => 2,
      subtotal: () => 10000,
      updateQuantity: mockUpdateQuantity,
      removeItem: mockRemoveItem,
      clearCart: mockClearCart,
      toggleAssurance: mockToggleAssurance,
    };
    return selector(state);
  }),
  formatPrice: (amount: number) => `NGN ${amount.toLocaleString()}`,
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: jest.fn(
    (selector: (state: { session: null }) => unknown) =>
      selector({ session: null })
  ),
}));

jest.mock('@/stores/ui-store', () => ({
  useUIStore: jest.fn(
    (selector: (state: { openNegotiation: typeof mockOpenNegotiation }) => unknown) =>
      selector({ openNegotiation: mockOpenNegotiation })
  ),
}));

jest.mock('zustand/react/shallow', () => ({
  useShallow: (fn: unknown) => fn,
}));

// Import AFTER mocks are set up
import CartScreen from './cart';
import { useCartStore } from '@/stores/cart-store';

describe('CartScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the cart header with item count', () => {
    render(<CartScreen />);

    expect(screen.getByText('Cart')).toBeTruthy();
    expect(screen.getByText('(2)')).toBeTruthy();
  });

  it('renders the product name in the cart list', () => {
    render(<CartScreen />);

    expect(screen.getByText('Test Product')).toBeTruthy();
  });

  it('renders the Clear All button', () => {
    render(<CartScreen />);

    expect(screen.getByText('Clear All')).toBeTruthy();
  });

  it('renders the Checkout button with total', () => {
    render(<CartScreen />);

    expect(screen.getByText('Checkout')).toBeTruthy();
  });

  it('renders the Secure Checkout badge in the list footer', () => {
    render(<CartScreen />);

    expect(screen.getByText('Secure Checkout')).toBeTruthy();
  });

  it('renders the condition tag for the cart item', () => {
    render(<CartScreen />);

    expect(screen.getByText('NEW')).toBeTruthy();
  });

  it('renders the Negotiate button for non-negotiated items', () => {
    render(<CartScreen />);

    expect(screen.getByText('Negotiate')).toBeTruthy();
  });

  it('renders the Ogabassey Assurance toggle label', () => {
    render(<CartScreen />);

    expect(screen.getByText('Ogabassey Assurance')).toBeTruthy();
  });
});

describe('CartScreen - empty state', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Override the cart store mock to return empty items
    jest.mocked(useCartStore).mockImplementation(
      (selector: (state: unknown) => unknown) => {
        const state = {
          items: [],
          itemCount: () => 0,
          subtotal: () => 0,
          updateQuantity: mockUpdateQuantity,
          removeItem: mockRemoveItem,
          clearCart: mockClearCart,
          toggleAssurance: mockToggleAssurance,
        };
        return selector(state);
      }
    );
  });

  it('renders the empty cart message', () => {
    render(<CartScreen />);

    expect(screen.getByText(/Your cart is empty/)).toBeTruthy();
    expect(
      screen.getByText('Browse our products and add items to your cart')
    ).toBeTruthy();
  });

  it('renders the Start Shopping button when cart is empty', () => {
    render(<CartScreen />);

    expect(screen.getByText('Start Shopping')).toBeTruthy();
  });
});
