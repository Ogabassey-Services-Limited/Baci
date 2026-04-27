import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { Linking } from 'react-native';

const mockRouterBack = jest.fn();
const mockRouterReplace = jest.fn();
const mockUseLocalSearchParams: jest.Mock<Record<string, string>, []> =
  jest.fn(() => ({ trackingToken: 'tok_123' }));

jest.mock('expo-router', () => ({
  Stack: {
    Screen: () => null,
  },
  router: {
    back: (...args: unknown[]) => mockRouterBack(...args),
    replace: (...args: unknown[]) => mockRouterReplace(...args),
  },
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        apiUrl: 'https://example.test',
        merchantSlug: 'ogabassey',
      },
    },
  },
}));

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'light'),
}));

jest.mock('@/lib/api-url', () => ({
  resolveApiBaseUrl: (value: string | undefined) => value ?? 'https://example.test',
}));

const ORDER_FIXTURE = {
  order: {
    id: 'order-1',
    order_number: 'ORD-001',
    status: 'placed',
    payment_status: 'paid',
    created_at: '2026-01-15T12:00:00.000Z',
    subtotal: 5000,
    shipping_cost: 1000,
    discount_amount: 0,
    total: 6000,
    currency: 'NGN',
  },
  customer: {
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '+2348000000000',
  },
  shipping_address: {
    address: '12 Marina Street',
    city: 'Lagos',
    state: 'Lagos',
    country: 'Nigeria',
  },
  items: [
    {
      id: 'item-1',
      product_id: 'prod-1',
      product_name: 'Test Product',
      quantity: 2,
      unit_price: 2500,
      total_price: 5000,
      product_image: null,
    },
  ],
  timeline: [
    {
      status: 'completed',
      title: 'Order Placed',
      description: 'We received your order',
      timestamp: '2026-01-15T12:00:00.000Z',
      icon: 'order' as const,
    },
  ],
  shipping_tracking: null,
  estimated_delivery: null,
  merchant: {
    name: 'Ogabassey',
    logo: null,
    support_email: 'support@ogabassey.test',
    support_phone: '+2348000000000',
  },
};

import TrackOrderScreen from './index';

const flushFetch = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

describe('TrackOrderScreen', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseLocalSearchParams.mockReturnValue({ trackingToken: 'tok_123' });
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const mockFetchOk = (body: unknown) => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => body,
    }) as unknown as typeof globalThis.fetch;
  };

  const mockFetchError = (message: string) => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: message }),
    }) as unknown as typeof globalThis.fetch;
  };

  it('renders the loading indicator while the order is being fetched', () => {
    globalThis.fetch = jest.fn(() => new Promise(() => {})) as unknown as typeof globalThis.fetch;

    render(<TrackOrderScreen />);

    expect(screen.getByText('Loading order details...')).toBeTruthy();
  });

  it('renders the error state and a Go Home button when the request fails', async () => {
    mockFetchError('Order not found');

    render(<TrackOrderScreen />);

    await waitFor(() => {
      expect(screen.getByText('Order not found')).toBeTruthy();
    });

    const homeBtn = screen.getByRole('button', { name: 'Return to home page' });
    expect(homeBtn).toBeTruthy();

    fireEvent.press(homeBtn);
    expect(mockRouterReplace).toHaveBeenCalledWith('/');
  });

  it('renders the missing-token error when no tracking token is provided', async () => {
    mockUseLocalSearchParams.mockReturnValue({});

    render(<TrackOrderScreen />);

    await waitFor(() => {
      expect(screen.getByText('No tracking token provided')).toBeTruthy();
    });
  });

  it('renders core accessibility-labelled controls when the order loads', async () => {
    mockFetchOk(ORDER_FIXTURE);

    render(<TrackOrderScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('Go back')).toBeTruthy();
    });

    expect(screen.getByLabelText('Continue shopping')).toBeTruthy();
    expect(screen.getByLabelText('Email Ogabassey support')).toBeTruthy();
    expect(screen.getByLabelText('Call Ogabassey support')).toBeTruthy();
  });

  it('navigates back when the back button is pressed', async () => {
    mockFetchOk(ORDER_FIXTURE);

    render(<TrackOrderScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('Go back')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Go back'));

    expect(mockRouterBack).toHaveBeenCalledTimes(1);
  });

  it('replaces with the home route when Continue Shopping is pressed', async () => {
    mockFetchOk(ORDER_FIXTURE);

    render(<TrackOrderScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('Continue shopping')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Continue shopping'));

    expect(mockRouterReplace).toHaveBeenCalledWith('/');
  });

  it('opens a mailto link when the email button is pressed', async () => {
    mockFetchOk(ORDER_FIXTURE);
    const openUrlSpy = jest
      .spyOn(Linking, 'openURL')
      .mockResolvedValue(true);

    render(<TrackOrderScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('Email Ogabassey support')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Email Ogabassey support'));

    expect(openUrlSpy).toHaveBeenCalledWith('mailto:support@ogabassey.test');
  });

  it('opens a tel link when the phone button is pressed', async () => {
    mockFetchOk(ORDER_FIXTURE);
    const openUrlSpy = jest
      .spyOn(Linking, 'openURL')
      .mockResolvedValue(true);

    render(<TrackOrderScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText('Call Ogabassey support')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Call Ogabassey support'));

    expect(openUrlSpy).toHaveBeenCalledWith('tel:+2348000000000');
  });

  it('does not render contact buttons when no merchant contact info is provided', async () => {
    mockFetchOk({
      ...ORDER_FIXTURE,
      merchant: {
        ...ORDER_FIXTURE.merchant,
        support_email: null,
        support_phone: null,
      },
    });

    render(<TrackOrderScreen />);
    await flushFetch();
    await waitFor(() => {
      expect(screen.getByLabelText('Continue shopping')).toBeTruthy();
    });

    expect(screen.queryByLabelText('Email Ogabassey support')).toBeNull();
    expect(screen.queryByLabelText('Call Ogabassey support')).toBeNull();
  });
});
