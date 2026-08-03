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
    on: jest.fn(() => channel),
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

describe('useOrderDetailsController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

  it('loads the order for the signed-in customer', async () => {
    const { result } = renderHook(() => useOrderDetailsController());

    await waitFor(() =>
      expect(result.current.order).toEqual({
        id: 'order-1',
        order_number: 'ORD-1',
      })
    );
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('clears stale order state when the signed-in customer changes on the same order id', async () => {
    const { rerender, result } = renderHook(() => useOrderDetailsController());
    await waitFor(() => expect(result.current.order).not.toBeNull());

    // The next identity's fetch stays in flight so any leak of the previous
    // customer's order would be visible.
    mockOrderSingle.mockImplementation(() => new Promise(() => undefined));
    mockAuthState.customer = { id: 'cust-2' };
    rerender(undefined);

    expect(result.current.order).toBeNull();
    expect(result.current.insurancePolicy).toBeNull();
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('reports a sign-in requirement instead of loading when the customer is missing', () => {
    mockAuthState.customer = null;

    const { result } = renderHook(() => useOrderDetailsController());

    expect(result.current.error).toBe('Please sign in to view order details');
    expect(result.current.isLoading).toBe(false);
    expect(mockOrderSingle).not.toHaveBeenCalled();
  });

  it('surfaces a load error when the order fetch fails', async () => {
    mockOrderSingle.mockResolvedValue({
      data: null,
      error: new Error('order fetch failed'),
    });

    const { result } = renderHook(() => useOrderDetailsController());

    await waitFor(() =>
      expect(result.current.error).toBe('Failed to load order details')
    );
    expect(result.current.order).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('derives canCancel from the customer_order_can_cancel RPC', async () => {
    const { result } = renderHook(() => useOrderDetailsController());

    await waitFor(() => expect(result.current.canCancel).toBe(true));
    expect(mockRpc).toHaveBeenCalledWith('customer_order_can_cancel', {
      p_order_id: 'order-1',
    });
  });

  it('treats the order as not cancellable when the RPC returns false', async () => {
    mockCanCancelRpc.mockResolvedValue({ data: false, error: null });

    const { result } = renderHook(() => useOrderDetailsController());

    await waitFor(() => expect(result.current.order).not.toBeNull());
    expect(result.current.canCancel).toBe(false);
  });

  it('treats the order as not cancellable when the RPC errors', async () => {
    mockCanCancelRpc.mockResolvedValue({
      data: null,
      error: new Error('rpc failed'),
    });

    const { result } = renderHook(() => useOrderDetailsController());

    await waitFor(() => expect(result.current.order).not.toBeNull());
    expect(result.current.canCancel).toBe(false);
  });

  it('prompts for a reason and cancels the order on confirmation', async () => {
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_title, _message, buttons) => {
        const confirmButton = buttons?.find(
          (button) => button.style === 'destructive'
        );
        confirmButton?.onPress?.();
      });

    const { result } = renderHook(() => useOrderDetailsController());
    await waitFor(() => expect(result.current.canCancel).toBe(true));

    await act(async () => {
      result.current.handleCancelOrder();
    });

    await waitFor(() => expect(mockCancelOrder).toHaveBeenCalledTimes(1));
    // Refetches after a successful cancellation.
    await waitFor(() =>
      expect(mockOrderSingle.mock.calls.length).toBeGreaterThan(1)
    );

    alertSpy.mockRestore();
  });

  it('does not cancel when the confirmation is dismissed', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {
      // Simulate the customer dismissing the confirmation without choosing.
    });

    const { result } = renderHook(() => useOrderDetailsController());
    await waitFor(() => expect(result.current.canCancel).toBe(true));

    await act(async () => {
      result.current.handleCancelOrder();
    });

    expect(mockCancelOrder).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('alerts when cancellation fails for a non-conflict reason', async () => {
    mockCancelOrder.mockRejectedValue(new Error('network down'));
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

    await act(async () => {
      result.current.handleCancelOrder();
    });

    await waitFor(() => expect(mockCancelOrder).toHaveBeenCalled());
    await waitFor(() =>
      expect(
        alertMessages.some((title) => /could not cancel order/i.test(title))
      ).toBe(true)
    );

    alertSpy.mockRestore();
  });
});
