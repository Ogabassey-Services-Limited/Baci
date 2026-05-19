import { render } from '@testing-library/react-native';
import type React from 'react';
import { Alert } from 'react-native';
import './checkout.component-mocks.test-utils';
import { createCheckoutFetchMock } from './checkout.fetch.test-utils';

const mockRouterBack = jest.fn();
const mockRouterPush = jest.fn();
const mockUseColorScheme = jest.fn(() => 'light');
export const mockAlert = jest.fn();
export const mockTrackCheckoutStarted = jest.fn();
export const mockTrackCheckoutStep = jest.fn();
export const mockTrackError = jest.fn();

const mockCartState = {
  clearCart: jest.fn(),
  items: [
    {
      condition: 'New',
      id: 'cart-item-1',
      image_url: 'https://example.com/item.jpg',
      name: 'iPhone 11 Pro Max',
      price: 470000,
      product_id: 'product-1',
      quantity: 1,
      slug: 'iphone-11-pro-max',
      storage: '64GB',
    },
  ],
  subtotal: () => 470000,
};

const mockUseAuthStatus = jest.fn(() => ({
  customer: null,
  isAuthenticated: false,
  isGuest: true,
  isInitialized: true,
  isLoading: false,
  user: null,
}));
let originalFetch: typeof global.fetch = global.fetch;

jest.mock('expo-router', () => ({
  Stack: {
    Screen: () => null,
  },
  router: {
    back: (...args: unknown[]) => mockRouterBack(...args),
    push: (...args: unknown[]) => mockRouterPush(...args),
  },
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

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
    useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
  };
});

jest.mock('@/hooks/use-auth-guard', () => ({
  useAuthStatus: () => mockUseAuthStatus(),
}));

jest.mock('@/stores/cart-store', () => ({
  formatPrice: (value: number) =>
    `₦${new Intl.NumberFormat('en-NG').format(value)}`,
  useCartStore: (selector: (state: typeof mockCartState) => unknown) =>
    selector(mockCartState),
}));

jest.mock('@/hooks/use-wallet', () => ({
  useWallet: () => ({
    data: {
      wallet: {
        balance: 0,
      },
    },
  }),
}));

jest.mock('@/hooks/useMerchantPaymentSettings', () => {
  const actual = jest.requireActual('@/hooks/useMerchantPaymentSettings');
  return {
    ...actual,
    useMerchantPaymentSettings: () => ({
      data: null,
    }),
  };
});

jest.mock('@/lib/supabase', () => ({
  calculateCommerce: jest.fn(
    async (
      _name: string,
      params: {
        assuranceFee: number;
        shippingFee: number;
        subtotal: number;
        taxRate: number;
      }
    ) => {
      const taxAmount = Math.round(params.subtotal * params.taxRate);
      return {
        taxAmount,
        total:
          params.subtotal + params.shippingFee + params.assuranceFee + taxAmount,
      };
    }
  ),
  supabase: {
    from: jest.fn(() => ({
      eq: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(async () => ({
            data: { saved_addresses: [] },
            error: null,
          })),
        })),
      })),
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(async () => ({
              data: { saved_addresses: [] },
              error: null,
            })),
          })),
        })),
      })),
    })),
  },
}));

jest.mock('@/services/analytics', () => ({
  trackCheckoutStarted: (...args: unknown[]) => mockTrackCheckoutStarted(...args),
  trackCheckoutStep: (...args: unknown[]) => mockTrackCheckoutStep(...args),
  trackError: (...args: unknown[]) => mockTrackError(...args),
  trackOrderCompleted: jest.fn(),
}));

jest.mock('@/services/orders', () => ({
  OrderError: class extends Error {
    code = 'TEST_ERROR';
  },
  createOrder: jest.fn(),
}));

jest.mock('@/services/push-notifications', () => ({
  scheduleLocalNotification: jest.fn(),
}));

export function setupCheckoutTest() {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(mockAlert);
  originalFetch = global.fetch;
  global.fetch = createCheckoutFetchMock() as jest.Mock;
}

export function teardownCheckoutTest() {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
}

export function renderCheckoutScreen() {
  const CheckoutScreen = require('@/app/checkout').default as React.ComponentType;
  return render(<CheckoutScreen />);
}
