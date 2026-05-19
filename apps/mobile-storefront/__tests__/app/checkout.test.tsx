import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type React from 'react';
import { Alert } from 'react-native';
import CheckoutScreen from '@/app/checkout';

const mockRouterBack = jest.fn();
const mockRouterPush = jest.fn();
const mockUseColorScheme = jest.fn(() => 'light');
const mockAlert = jest.fn();
const mockTrackCheckoutStarted = jest.fn();
const mockTrackCheckoutStep = jest.fn();
const mockTrackError = jest.fn();

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
    SafeAreaView: ({
      children,
    }: {
      children: React.ReactNode;
    }) => <View>{children}</View>,
    useSafeAreaInsets: () => ({
      bottom: 0,
      left: 0,
      right: 0,
      top: 0,
    }),
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

jest.mock('@/components/checkout/CheckoutStepper', () => ({
  CheckoutStepper: ({ step }: { step: string }) => {
    const { Text } = require('react-native');
    return <Text accessibilityLabel="checkout-step">step:{step}</Text>;
  },
}));

jest.mock('@/components/checkout/DeliveryMethodCard', () => ({
  DeliveryMethodCard: ({
    onSelectMethod,
  }: {
    onSelectMethod: (method: 'door' | 'pickup_station' | 'airport') => void;
  }) => {
    const { Pressable, Text, View } = require('react-native');
    return (
      <View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Select pickup station"
          onPress={() => onSelectMethod('pickup_station')}
        >
          <Text>Pickup Station</Text>
        </Pressable>
      </View>
    );
  },
}));

jest.mock('@/components/checkout/PickupStationCard', () => ({
  AIRPORT_DELIVERY_FEE: 0,
  PICKUP_STATION_ADDRESS_LINES: ['No. 5 Example Plaza'],
  PICKUP_STATION_CITY: 'Lagos',
  PICKUP_STATION_STATE: 'Lagos',
  PickupStationCard: () => {
    const { Text } = require('react-native');
    return <Text>Pickup station card</Text>;
  },
}));

jest.mock('@/components/checkout/ShippingQuotesCard', () => ({
  ShippingQuotesCard: () => {
    const { Text } = require('react-native');
    return <Text>Shipping quotes card</Text>;
  },
}));

jest.mock('@/components/checkout/CryptoSelectionModal', () => ({
  CryptoSelectionModal: () => null,
}));

jest.mock('@/components/checkout/DeliveryNotesCard', () => ({
  DeliveryNotesCard: ({
    children,
  }: {
    children: unknown;
  }) => {
    const { View } = require('react-native');
    return <View>{children}</View>;
  },
}));

jest.mock('@/components/checkout/PaymentMethodSelector', () => ({
  PaymentMethodSelector: () => {
    const { Text } = require('react-native');
    return <Text>Payment methods selector</Text>;
  },
}));

jest.mock('@/components/ui/AddressAutocomplete', () => ({
  AddressAutocomplete: ({
    value,
    onChangeText,
  }: {
    value: string;
    onChangeText: (value: string) => void;
  }) => {
    const { TextInput } = require('react-native');
    return (
      <TextInput
        placeholder="Start typing your address..."
        value={value}
        onChangeText={onChangeText}
      />
    );
  },
}));

jest.mock('@/components/ui/PhoneInput', () => ({
  PhoneInput: ({
    value,
    onBlur,
    onChangeText,
  }: {
    value: string;
    onBlur: () => void;
    onChangeText: (value: string) => void;
  }) => {
    const { TextInput } = require('react-native');
    return (
      <TextInput
        placeholder="e.g. 08012345678"
        value={value}
        onBlur={onBlur}
        onChangeText={onChangeText}
      />
    );
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

describe('CheckoutScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(mockAlert);
    global.fetch = jest.fn(async (input: string | URL | Request) => {
      const requestUrl =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      if (requestUrl.includes('/api/shipping/locations?state=')) {
        return {
          json: async () => ({
            locations: [
              { city: 'Lagos', state: 'Lagos' },
              { city: 'Ikeja', state: 'Lagos' },
            ],
          }),
          ok: true,
        } as Response;
      }

      if (requestUrl.includes('/api/shipping/locations')) {
        return {
          json: async () => ({ states: ['Lagos', 'Abuja'] }),
          ok: true,
        } as Response;
      }

      if (requestUrl.includes('/api/shipping/quotes')) {
        return {
          json: async () => ({ quotes: { all: [] } }),
          ok: true,
        } as Response;
      }

      return {
        json: async () => ({}),
        ok: true,
      } as Response;
    }) as jest.Mock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders checkout with address step visible by default', async () => {
    render(<CheckoutScreen />);

    expect(screen.getByText('Checkout')).toBeOnTheScreen();
    expect(screen.getByText('Delivery Address')).toBeOnTheScreen();
    expect(screen.getByLabelText('checkout-step')).toHaveTextContent(
      'step:address'
    );

    await waitFor(() => {
      expect(mockTrackCheckoutStarted).toHaveBeenCalledTimes(1);
    });
  });

  it('continues from address to payment when required fields are valid', async () => {
    render(<CheckoutScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('E.g. John'), 'Ada');
    fireEvent.changeText(screen.getByPlaceholderText('E.g. Doe'), 'Lovelace');
    fireEvent.changeText(
      screen.getByPlaceholderText('e.g. 08012345678'),
      '08031234567'
    );
    fireEvent.changeText(
      screen.getByPlaceholderText('john@example.com'),
      'ada@example.com'
    );

    fireEvent.press(screen.getByLabelText('Select pickup station'));
    fireEvent.press(screen.getByLabelText('Continue to payment'));

    await waitFor(() => {
      expect(screen.getByText('Payment Method')).toBeOnTheScreen();
      expect(screen.getByLabelText('checkout-step')).toHaveTextContent(
        'step:payment'
      );
    });
  });
});
