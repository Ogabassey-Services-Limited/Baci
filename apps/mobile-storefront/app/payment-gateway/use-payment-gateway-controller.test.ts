import { jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Alert } from 'react-native';
import type { WebViewNavigation } from 'react-native-webview';
import {
  VtuPaymentStillProcessingError,
  waitForVtuConfirmation,
} from '@/lib/vtu-checkout';
import { usePaymentGatewayController } from './use-payment-gateway-controller';

const mockClearCart = jest.fn();
const mockToastError = jest.fn();
const mockToastSuccess = jest.fn();
const mockToastComponent = jest.fn(() => null);

let mockSearchParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    replace: jest.fn(),
  },
  useLocalSearchParams: () => mockSearchParams,
}));

jest.mock('@/components/ui/Toast', () => ({
  useToast: () => ({
    error: mockToastError,
    success: mockToastSuccess,
    Toast: mockToastComponent,
  }),
}));

jest.mock('@/lib/clipboard', () => ({
  setClipboardString: jest.fn(() => Promise.resolve(true)),
}));

jest.mock('@/lib/vtu-checkout', () => {
  const actual =
    jest.requireActual<typeof import('@/lib/vtu-checkout')>(
      '@/lib/vtu-checkout'
    );

  return {
    ...actual,
    waitForVtuConfirmation: jest.fn(),
  };
});

jest.mock('@/stores/cart-store', () => ({
  useCartStore: (selector: (state: { clearCart: () => void }) => unknown) =>
    selector({ clearCart: mockClearCart }),
}));

const mockWaitForVtuConfirmation = jest.mocked(waitForVtuConfirmation);

const orderParams = {
  amount: '1000',
  authorizationUrl: 'https://checkout.paystack.com/test',
  gateway: 'paystack',
  orderId: 'order-123',
  orderNumber: 'ORD-123',
  paymentKind: 'order',
  reference: 'ref-123',
};

const vtuParams = {
  amount: '2500',
  authorizationUrl: 'https://checkout.paystack.com/test',
  customerIdentifier: '43901766923',
  gateway: 'paystack',
  paymentKind: 'vtu',
  reference: 'VTU-123',
  utilityType: 'power',
};

function navigation(url: string) {
  return { url } as WebViewNavigation;
}

function deferred<T>() {
  let reject!: (reason?: unknown) => void;
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
}

describe('usePaymentGatewayController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    mockSearchParams = { ...orderParams };
    mockWaitForVtuConfirmation.mockResolvedValue({
      amount: 2500,
      reference: 'VTU-123',
      status: 'successful',
    });
  });

  it('reports invalid route params without exposing checkout state as valid', () => {
    mockSearchParams = {
      gateway: 'paystack',
      paymentKind: 'order',
      reference: 'ref-123',
    };

    const { result } = renderHook(() => usePaymentGatewayController());

    expect(result.current.validatedParams).toMatchObject({
      data: null,
      isValid: false,
    });
    expect(result.current.validatedParams.error).toBeTruthy();
  });

  it('preserves cancellation errors through later WebView load events', () => {
    const { result } = renderHook(() => usePaymentGatewayController());

    act(() => {
      result.current.handleNavigationChange(
        navigation('https://checkout.example.com/pay?cancelled=true')
      );
    });

    expect(result.current.status).toBe('error');
    expect(result.current.errorMessage).toBe('Payment was cancelled.');

    act(() => {
      result.current.handleLoadStart();
      result.current.handleLoadEnd();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.errorMessage).toBe('Payment was cancelled.');
  });

  it('resets retry state and reloads the checkout WebView', () => {
    const reload = jest.fn();
    const { result } = renderHook(() => usePaymentGatewayController());

    act(() => {
      result.current.handleNavigationChange(
        navigation('https://checkout.example.com/cancel')
      );
    });

    result.current.webViewRef.current = {
      reload,
    } as unknown as typeof result.current.webViewRef.current;

    act(() => {
      result.current.handleRetry();
    });

    expect(result.current.status).toBe('loading');
    expect(result.current.errorMessage).toBeNull();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('clears the cart and navigates after order payment completion', () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => usePaymentGatewayController());

    act(() => {
      result.current.handleNavigationChange(
        navigation('https://usebaci.com/checkout/success?trxref=ref-123')
      );
    });

    expect(result.current.status).toBe('success');
    expect(mockClearCart).toHaveBeenCalledTimes(1);

    act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(router.replace).toHaveBeenCalledWith({
      pathname: '/order-success',
      params: {
        orderId: 'order-123',
        orderNumber: 'ORD-123',
        paymentMethod: 'paystack',
        reference: 'ref-123',
      },
    });
  });

  it('uses the close confirmation flow for back actions', () => {
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation(() => undefined);
    const { result } = renderHook(() => usePaymentGatewayController());

    act(() => {
      result.current.handleBack();
    });

    expect(alertSpy).toHaveBeenCalledWith(
      'Cancel Payment?',
      'Your order has been created. If you leave, you can complete payment later from your orders page.',
      expect.any(Array)
    );
    expect(router.back).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it('uses an empty order id when delayed order navigation has no orderId', () => {
    jest.useFakeTimers();
    mockSearchParams = {
      ...orderParams,
      orderId: undefined as unknown as string,
      orderNumber: 'ORD-123',
    };
    const { result } = renderHook(() => usePaymentGatewayController());

    act(() => {
      result.current.handleNavigationChange(
        navigation('https://usebaci.com/checkout/success?trxref=ref-123')
      );
    });
    act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(router.replace).toHaveBeenCalledWith({
      pathname: '/order-success',
      params: expect.objectContaining({ orderId: '' }),
    });
  });

  it('polls VTU confirmations and routes successful utility payments', async () => {
    jest.useFakeTimers({ advanceTimers: true });
    mockSearchParams = { ...vtuParams };
    const { result } = renderHook(() => usePaymentGatewayController());

    act(() => {
      result.current.handleNavigationChange(
        navigation('https://usebaci.com/checkout/success?reference=VTU-123')
      );
    });

    expect(result.current.status).toBe('processing');
    await waitFor(() =>
      expect(mockWaitForVtuConfirmation).toHaveBeenCalledWith({
        gateway: 'paystack',
        reference: 'VTU-123',
      })
    );

    await waitFor(() => expect(result.current.status).toBe('success'));

    act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(router.replace).toHaveBeenCalledWith({
      pathname: '/utilities/[type]',
      params: {
        amount: '2500',
        customerIdentifier: '43901766923',
        paymentStatus: 'successful',
        reference: 'VTU-123',
        type: 'power',
      },
    });
  });

  it('ignores stale successful VTU confirmations after retry', async () => {
    jest.useFakeTimers({ advanceTimers: true });
    mockSearchParams = { ...vtuParams };
    const confirmation =
      deferred<Awaited<ReturnType<typeof waitForVtuConfirmation>>>();
    mockWaitForVtuConfirmation.mockImplementationOnce(
      () => confirmation.promise
    );
    const { result } = renderHook(() => usePaymentGatewayController());

    act(() => {
      result.current.handleNavigationChange(
        navigation('https://usebaci.com/checkout/success?reference=VTU-123')
      );
    });

    await waitFor(() =>
      expect(mockWaitForVtuConfirmation).toHaveBeenCalledTimes(1)
    );

    act(() => {
      result.current.handleRetry();
    });

    await act(async () => {
      confirmation.resolve({
        amount: 2500,
        reference: 'VTU-123',
        status: 'successful',
      });
    });
    act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(result.current.status).toBe('loading');
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('ignores stale still-processing VTU confirmations after retry', async () => {
    mockSearchParams = { ...vtuParams };
    const confirmation =
      deferred<Awaited<ReturnType<typeof waitForVtuConfirmation>>>();
    mockWaitForVtuConfirmation.mockImplementationOnce(
      () => confirmation.promise
    );
    const { result } = renderHook(() => usePaymentGatewayController());

    act(() => {
      result.current.handleNavigationChange(
        navigation('https://usebaci.com/checkout/success?reference=VTU-123')
      );
    });

    await waitFor(() =>
      expect(mockWaitForVtuConfirmation).toHaveBeenCalledTimes(1)
    );

    act(() => {
      result.current.handleRetry();
    });

    await act(async () => {
      confirmation.reject(
        new VtuPaymentStillProcessingError({
          reference: 'VTU-123',
        })
      );
    });

    expect(result.current.status).toBe('loading');
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('does not route VTU confirmations after unmount', async () => {
    mockSearchParams = { ...vtuParams };
    const confirmation =
      deferred<Awaited<ReturnType<typeof waitForVtuConfirmation>>>();
    mockWaitForVtuConfirmation.mockImplementationOnce(
      () => confirmation.promise
    );
    const { result, unmount } = renderHook(() => usePaymentGatewayController());

    act(() => {
      result.current.handleNavigationChange(
        navigation('https://usebaci.com/checkout/success?reference=VTU-123')
      );
    });

    await waitFor(() =>
      expect(mockWaitForVtuConfirmation).toHaveBeenCalledTimes(1)
    );

    unmount();

    await act(async () => {
      confirmation.reject(
        new VtuPaymentStillProcessingError({
          reference: 'VTU-123',
        })
      );
    });

    expect(router.replace).not.toHaveBeenCalled();
  });

  it('preserves VTU cashback params when routing successful utility payments', async () => {
    jest.useFakeTimers({ advanceTimers: true });
    mockSearchParams = { ...vtuParams };
    mockWaitForVtuConfirmation.mockResolvedValue({
      amount: 2500,
      cashback: {
        amount: 50,
        credited: true,
        newBalance: 1050,
      },
      reference: 'VTU-123',
      status: 'successful',
    });
    const { result } = renderHook(() => usePaymentGatewayController());

    act(() => {
      result.current.handleNavigationChange(
        navigation('https://usebaci.com/checkout/success?reference=VTU-123')
      );
    });

    await waitFor(() => expect(result.current.status).toBe('success'));

    act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(router.replace).toHaveBeenCalledWith({
      pathname: '/utilities/[type]',
      params: expect.objectContaining({
        cashbackAmount: '50',
        cashbackNewBalance: '1050',
        paymentStatus: 'successful',
        reference: 'VTU-123',
      }),
    });
  });

  it('routes Juicyway VTU completions without polling confirmation', async () => {
    jest.useFakeTimers({ advanceTimers: true });
    mockSearchParams = {
      ...vtuParams,
      gateway: 'juicyway',
      reference: 'JW-123',
    };
    const { result } = renderHook(() => usePaymentGatewayController());

    act(() => {
      result.current.handleNavigationChange(
        navigation('https://usebaci.com/checkout/success?reference=JW-123')
      );
    });

    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(mockWaitForVtuConfirmation).not.toHaveBeenCalled();

    act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(router.replace).toHaveBeenCalledWith({
      pathname: '/utilities/[type]',
      params: {
        amount: '2500',
        customerIdentifier: '43901766923',
        paymentStatus: 'successful',
        reference: 'JW-123',
        type: 'power',
      },
    });
  });

  it('cancels pending Juicyway VTU navigation when retrying', async () => {
    jest.useFakeTimers({ advanceTimers: true });
    mockSearchParams = {
      ...vtuParams,
      gateway: 'juicyway',
      reference: 'JW-123',
    };
    const { result } = renderHook(() => usePaymentGatewayController());

    act(() => {
      result.current.handleNavigationChange(
        navigation('https://usebaci.com/checkout/success?reference=JW-123')
      );
    });

    await waitFor(() => expect(result.current.status).toBe('success'));

    act(() => {
      result.current.handleRetry();
      jest.runOnlyPendingTimers();
    });

    expect(result.current.status).toBe('loading');
    expect(router.replace).not.toHaveBeenCalled();
  });
});
