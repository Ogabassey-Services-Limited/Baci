import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useOrderDetailsController } from './use-order-details-controller';

type OrderSingleResult = { data: unknown; error: Error | null };
type PolicyListResult = { data: unknown[]; error: Error | null };
type CanCancelRpcResult = { data: boolean | null; error: Error | null };

const mockOrderSingle = jest.fn<() => Promise<OrderSingleResult>>();
const mockPolicyLimit = jest.fn<() => Promise<PolicyListResult>>();
const mockCanCancelRpc = jest.fn<() => Promise<CanCancelRpcResult>>();
const mockRpc = jest.fn((..._args: unknown[]) => mockCanCancelRpc());
const mockCancelOrder = jest.fn<(reason?: string) => Promise<boolean>>();
const mockNotCancellableRef = { current: false };
const mockRemoveChannel = jest.fn();
const mockTrackingWakeup = { current: null as (() => void) | null };
const mockUseLocalSearchParams = jest.fn<() => { id?: string }>();
const mockAuthState: {
  user: { id: string } | null;
  customer: { id: string } | null;
} = { user: null, customer: null };

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    canGoBack: jest.fn(() => false),
    push: jest.fn(),
    replace: jest.fn(),
  },
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: (selector: (state: typeof mockAuthState) => unknown) =>
    selector(mockAuthState),
}));

jest.mock('@/hooks/use-receipt-preview', () => ({
  useReceiptPreview: () => ({ openPreviewByOrderId: jest.fn() }),
}));

jest.mock('@/hooks/use-receipts', () => ({
  useMerchantReceiptInfo: () => ({ data: null }),
}));

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  }),
}));

jest.mock('@/lib/validation', () => ({
  isOrderRealtimePayload: () => false,
}));

jest.mock('@/lib/post-purchase-actions', () => ({
  BACI_GOOGLE_REVIEW_URL: 'https://example.com/review',
  CUSTOMER_CANCELLATION_REASONS: [
    'Changed my mind',
    'Ordered by mistake',
    'Other',
  ],
  canCancelStorefrontOrder: () => true,
}));

jest.mock('@/hooks/use-cancel-order', () => ({
  useCancelOrder: () => ({
    cancelOrder: (reason?: string) => mockCancelOrder(reason),
    error: null,
    isCancelling: false,
    notCancellable: mockNotCancellableRef.current,
  }),
}));

jest.mock('./order-details.helpers', () => ({
  getOrderTrackingUrl: () => null,
  mapOrderDetails: (raw: unknown) => raw,
}));

jest.mock('@/lib/supabase', () => {
  const channel = {
    on: jest.fn(
      (
        type: string,
        config: { event?: string },
        callback: (() => void) | undefined
      ) => {
        if (
          type === 'broadcast' &&
          config.event === 'shipment_tracking_changed'
        ) {
          mockTrackingWakeup.current = callback ?? null;
        }
        return channel;
      }
    ),
    subscribe: jest.fn(() => channel),
  };
  return {
    supabase: {
      channel: () => channel,
      removeChannel: (...args: unknown[]) => mockRemoveChannel(...args),
      rpc: (...args: unknown[]) => mockRpc(...args),
      from: (table: string) =>
        table === 'orders'
          ? {
              select: () => ({
                eq: () => ({
                  eq: () => ({ single: () => mockOrderSingle() }),
                }),
              }),
            }
          : {
              select: () => ({
                eq: () => ({
                  order: () => ({ limit: () => mockPolicyLimit() }),
                }),
              }),
            },
    },
  };
});

describe('useOrderDetailsController tracking wakeups', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTrackingWakeup.current = null;
    mockNotCancellableRef.current = false;
    mockUseLocalSearchParams.mockReturnValue({ id: 'order-1' });
    mockAuthState.user = { id: 'user-1' };
    mockAuthState.customer = { id: 'cust-1' };
    mockOrderSingle.mockResolvedValue({
      data: { id: 'order-1', order_number: 'ORD-1' },
      error: null,
    });
    mockPolicyLimit.mockResolvedValue({ data: [], error: null });
    mockCanCancelRpc.mockResolvedValue({ data: true, error: null });
    mockCancelOrder.mockResolvedValue(true);
  });

  it('refetches order details when the private shipment tracking wakeup arrives', async () => {
    renderHook(() => useOrderDetailsController());
    await waitFor(() => expect(mockTrackingWakeup.current).not.toBeNull());
    const fetchCallsBefore = mockOrderSingle.mock.calls.length;

    await act(async () => {
      mockTrackingWakeup.current?.();
    });

    await waitFor(() =>
      expect(mockOrderSingle.mock.calls.length).toBeGreaterThan(
        fetchCallsBefore
      )
    );
  });

  it('alerts and refetches when the order can no longer be cancelled', async () => {
    mockNotCancellableRef.current = true;
    mockCancelOrder.mockResolvedValue(false);
    const alertMessages: string[] = [];
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation((title, _message, buttons) => {
        alertMessages.push(String(title));
        const confirmButton = buttons?.find(
          (button) => button.style === 'destructive'
        );
        confirmButton?.onPress?.();
      });

    const { result } = renderHook(() => useOrderDetailsController());
    await waitFor(() => expect(result.current.canCancel).toBe(true));
    const fetchCallsBefore = mockOrderSingle.mock.calls.length;

    await act(async () => {
      result.current.handleCancelOrder();
    });

    await waitFor(() => expect(mockCancelOrder).toHaveBeenCalled());
    await waitFor(() =>
      expect(
        alertMessages.some((title) => /can no longer be cancelled/i.test(title))
      ).toBe(true)
    );
    await waitFor(() =>
      expect(mockOrderSingle.mock.calls.length).toBeGreaterThan(
        fetchCallsBefore
      )
    );

    alertSpy.mockRestore();
  });
});
