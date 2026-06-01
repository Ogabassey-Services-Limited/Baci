import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, waitFor } from '@testing-library/react-native';
import OrderSuccessScreen from '@/app/order-success';

const mockScheduleLocalNotification =
  jest.fn<(...args: unknown[]) => Promise<void>>();
const mockRequestPermission = jest.fn(async () => 'granted');
const mockTriggerSystemPrompt = jest.fn();
const mockMarkDenied = jest.fn();
let mockSearchParams: Record<string, string> = {
  orderId: 'order-1',
  orderNumber: 'BAC-001',
  paymentMethod: 'paystack',
  reference: 'pay-ref',
  trackingToken: 'tracking-token',
};

jest.mock('expo-router', () => ({
  router: {
    replace: jest.fn(),
  },
  useLocalSearchParams: () => mockSearchParams,
}));

jest.mock('@/components/orders/OrderSuccessView', () => ({
  OrderSuccessView: () => {
    const { View } =
      jest.requireActual<typeof import('react-native')>('react-native');
    return <View testID="order-success-view" />;
  },
}));

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

jest.mock('@/hooks/use-permission-booster', () => ({
  usePermissionBooster: () => ({
    markDenied: mockMarkDenied,
    requestPermission: mockRequestPermission,
    triggerSystemPrompt: mockTriggerSystemPrompt,
  }),
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: (selector: (state: { customer: null }) => unknown) =>
    selector({ customer: null }),
}));

jest.mock('@/services/push-notifications', () => ({
  scheduleLocalNotification: (...args: unknown[]) =>
    mockScheduleLocalNotification(...args),
}));

describe('OrderSuccessScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockScheduleLocalNotification.mockResolvedValue(undefined);
    mockSearchParams = {
      orderId: 'order-1',
      orderNumber: 'BAC-001',
      paymentMethod: 'paystack',
      reference: 'pay-ref',
      trackingToken: 'tracking-token',
    };
  });

  it('schedules the order received notification only after the success screen loads', async () => {
    render(<OrderSuccessScreen />);

    await waitFor(() => {
      expect(mockScheduleLocalNotification).toHaveBeenCalledWith(
        'Order Received! 📦',
        "Your order #BAC-001 is being processed. We'll notify you when it ships.",
        {
          orderId: 'order-1',
          orderNumber: 'BAC-001',
          type: 'order_update',
        },
        1
      );
    });
  });

  it('does not schedule an order notification when order identity is missing', async () => {
    mockSearchParams = {};

    render(<OrderSuccessScreen />);

    await waitFor(() => {
      expect(mockScheduleLocalNotification).not.toHaveBeenCalled();
    });
  });

  it('falls back to orderId when orderNumber is blank', async () => {
    mockSearchParams = {
      orderId: 'order-1',
      orderNumber: '   ',
      paymentMethod: 'paystack',
      reference: 'pay-ref',
      trackingToken: 'tracking-token',
    };

    render(<OrderSuccessScreen />);

    await waitFor(() => {
      expect(mockScheduleLocalNotification).toHaveBeenCalledWith(
        'Order Received! 📦',
        "Your order #order-1 is being processed. We'll notify you when it ships.",
        {
          orderId: 'order-1',
          orderNumber: 'order-1',
          type: 'order_update',
        },
        1
      );
    });
  });

  it('does not schedule the order notification twice on rerender', async () => {
    const { rerender } = render(<OrderSuccessScreen />);

    await waitFor(() => {
      expect(mockScheduleLocalNotification).toHaveBeenCalledTimes(1);
    });

    rerender(<OrderSuccessScreen />);

    await waitFor(() => {
      expect(mockScheduleLocalNotification).toHaveBeenCalledTimes(1);
    });
  });
});
