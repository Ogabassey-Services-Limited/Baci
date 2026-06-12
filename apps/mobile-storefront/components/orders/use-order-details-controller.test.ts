import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { renderHook, waitFor } from '@testing-library/react-native';
import { useOrderDetailsController } from './use-order-details-controller';

type OrderSingleResult = { data: unknown; error: Error | null };
type PolicyListResult = { data: unknown[]; error: Error | null };

const mockOrderSingle = jest.fn<() => Promise<OrderSingleResult>>();
const mockPolicyLimit = jest.fn<() => Promise<PolicyListResult>>();
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
    mockUseLocalSearchParams.mockReturnValue({ id: 'order-1' });
    mockAuthState.user = { id: 'user-1' };
    mockAuthState.customer = { id: 'cust-1' };
    mockOrderSingle.mockResolvedValue({
      data: { id: 'order-1', order_number: 'ORD-1' },
      error: null,
    });
    mockPolicyLimit.mockResolvedValue({ data: [], error: null });
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
});
