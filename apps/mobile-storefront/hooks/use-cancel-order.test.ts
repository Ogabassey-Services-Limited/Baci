import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useCancelOrder } from './use-cancel-order';

const mockFetchJson = jest.fn();

jest.mock('@/lib/storefront-customer-api-client', () => ({
  createStorefrontCustomerApiClient: () => ({
    buildMerchantIdentifiers: jest.fn(() => ({})),
    fetchJson: (...args: unknown[]) => mockFetchJson(...args),
  }),
}));

const orderId = '22222222-2222-4222-8222-222222222222';

describe('useCancelOrder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchJson.mockResolvedValue({ success: true });
  });

  it('starts idle with no loading or error', () => {
    const { result } = renderHook(() => useCancelOrder(orderId));

    expect(result.current.isCancelling).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('posts the cancellation with the selected reason and resolves true', async () => {
    const { result } = renderHook(() => useCancelOrder(orderId));

    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.cancelOrder('Changed my mind');
    });

    expect(outcome).toBe(true);
    expect(mockFetchJson).toHaveBeenCalledWith({
      body: { reason: 'Changed my mind' },
      method: 'POST',
      path: `/api/storefront/account/orders/${orderId}/cancel`,
    });
    expect(result.current.isCancelling).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('omits the reason from the request body when none is provided', async () => {
    const { result } = renderHook(() => useCancelOrder(orderId));

    await act(async () => {
      await result.current.cancelOrder();
    });

    expect(mockFetchJson).toHaveBeenCalledWith({
      body: {},
      method: 'POST',
      path: `/api/storefront/account/orders/${orderId}/cancel`,
    });
  });

  it('surfaces a generic error and resolves false on transport failure', async () => {
    mockFetchJson.mockRejectedValueOnce(new Error('network down'));
    const { result } = renderHook(() => useCancelOrder(orderId));

    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.cancelOrder('Ordered by mistake');
    });

    expect(outcome).toBe(false);
    await waitFor(() => expect(result.current.error).toBe('network down'));
    expect(result.current.isCancelling).toBe(false);
  });

  it('flags the 409 order_not_cancellable case via the returned code', async () => {
    const conflict = new Error('Order can no longer be cancelled') as Error & {
      code?: string;
    };
    conflict.code = 'order_not_cancellable';
    mockFetchJson.mockRejectedValueOnce(conflict);
    const { result } = renderHook(() => useCancelOrder(orderId));

    let outcome:
      | Awaited<ReturnType<typeof result.current.cancelOrder>>
      | undefined;
    await act(async () => {
      outcome = await result.current.cancelOrder('Found a better price');
    });

    expect(outcome).toBe(false);
    expect(result.current.notCancellable).toBe(true);
    expect(result.current.isCancelling).toBe(false);
  });
});
