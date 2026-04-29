import { jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import type { VTUHistoryTransaction } from '@/hooks/use-vtu-history';
import { setClipboardString } from '@/lib/clipboard';
import { shareUtilityReceipt } from '@/lib/utility-receipt';
import { utilityRepeatHelpers } from '@/lib/utility-repeat';
import { confirmVtuCheckout } from '@/lib/vtu-checkout';
import { useUtilityHistoryActions } from './use-utility-history-actions';

const mockRouterPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockRouterPush,
  }),
}));

jest.mock('@/lib/clipboard', () => ({
  setClipboardString: jest.fn(),
}));

jest.mock('@/lib/utility-receipt', () => ({
  shareUtilityReceipt: jest.fn(),
}));

jest.mock('@/lib/vtu-checkout', () => ({
  confirmVtuCheckout: jest.fn(),
}));

jest.mock('@/lib/utility-repeat', () => ({
  utilityRepeatHelpers: {
    getDefaults: jest.fn(),
    getRouteParams: jest.fn(),
    getRouteType: jest.fn(),
  },
}));

const mockSetClipboardString = jest.mocked(setClipboardString);
const mockShareUtilityReceipt = jest.mocked(shareUtilityReceipt);
const mockConfirmVtuCheckout = jest.mocked(confirmVtuCheckout);
const mockGetRouteParams = jest.mocked(utilityRepeatHelpers.getRouteParams);
const mockGetRouteType = jest.mocked(utilityRepeatHelpers.getRouteType);

function createTransaction(
  overrides: Partial<VTUHistoryTransaction> = {}
): VTUHistoryTransaction {
  return {
    amount: 2500,
    created_at: '2026-04-08T12:00:00.000Z',
    customer_identifier: '43901766923',
    customer_name: 'Jane Customer',
    id: 'tx-1',
    payment_gateway: 'paystack',
    payment_reference: 'PAY-123',
    payment_status: 'completed',
    phone_number: '08012345678',
    request_reference: 'VTU-123',
    status: 'successful',
    type: 'electricity',
    voucher_pin: '1234-5678',
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
}

describe('useUtilityHistoryActions', () => {
  const refetch = jest.fn<() => Promise<unknown>>();
  let alertSpy: jest.SpiedFunction<typeof Alert.alert>;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    jest.clearAllMocks();
    refetch.mockResolvedValue(undefined);
    mockSetClipboardString.mockResolvedValue(true);
    mockShareUtilityReceipt.mockResolvedValue(undefined);
    mockConfirmVtuCheckout.mockResolvedValue({
      amount: 2500,
      reference: 'PAY-123',
      status: 'successful',
    });
    mockGetRouteParams.mockReturnValue({
      type: 'power',
      repeatCustomerIdentifier: '43901766923',
    });
    mockGetRouteType.mockReturnValue('power');
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    alertSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('routes repeat transactions with repeat params', () => {
    const transaction = createTransaction();
    const { result } = renderHook(() => useUtilityHistoryActions({ refetch }));

    act(() => {
      result.current.handleRepeatTransaction(transaction);
    });

    expect(mockGetRouteParams).toHaveBeenCalledWith(transaction);
    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: '/utilities/[type]',
      params: {
        type: 'power',
        repeatCustomerIdentifier: '43901766923',
      },
    });
  });

  it('copies trimmed voucher tokens', async () => {
    const { result } = renderHook(() => useUtilityHistoryActions({ refetch }));

    await act(async () => {
      await result.current.handleCopyVoucher('  1234-5678  ');
    });

    expect(mockSetClipboardString).toHaveBeenCalledWith('1234-5678');
    expect(alertSpy).toHaveBeenCalledWith(
      'Copied',
      'Token copied to clipboard.'
    );
  });

  it('reports copy failures', async () => {
    mockSetClipboardString.mockRejectedValueOnce(new Error('copy failed'));
    const { result } = renderHook(() => useUtilityHistoryActions({ refetch }));

    await act(async () => {
      await result.current.handleCopyVoucher('1234-5678');
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to copy utility voucher token:',
      expect.any(Error)
    );
    expect(alertSpy).toHaveBeenCalledWith(
      'Copy Failed',
      'Could not copy this token.'
    );
  });

  it('reports non-throwing clipboard failures', async () => {
    mockSetClipboardString.mockResolvedValueOnce(false);
    const { result } = renderHook(() => useUtilityHistoryActions({ refetch }));

    await act(async () => {
      await result.current.handleCopyVoucher('  1234-5678  ');
    });

    expect(mockSetClipboardString).toHaveBeenCalledWith('1234-5678');
    expect(Alert.alert).toHaveBeenCalledWith(
      'Copy Failed',
      'Could not copy this token.'
    );
  });

  it('shares receipts, blocks concurrent shares, and clears sharing state', async () => {
    const share = deferred<void>();
    mockShareUtilityReceipt.mockReturnValueOnce(share.promise);
    const transaction = createTransaction();
    const { result } = renderHook(() => useUtilityHistoryActions({ refetch }));

    act(() => {
      void result.current.handleShareReceipt(transaction);
      void result.current.handleShareReceipt(transaction);
    });

    expect(mockShareUtilityReceipt).toHaveBeenCalledTimes(1);
    expect(mockShareUtilityReceipt).toHaveBeenCalledWith({
      amount: 2500,
      customerIdentifier: '43901766923',
      customerName: 'Jane Customer',
      reference: 'VTU-123',
      status: 'successful',
      type: 'power',
      voucherPin: '1234-5678',
    });
    await waitFor(() =>
      expect(result.current.sharingTransactionId).toBe('tx-1')
    );

    await act(async () => {
      share.resolve(undefined);
      await share.promise;
    });

    await waitFor(() => expect(result.current.sharingTransactionId).toBeNull());
  });

  it('alerts when receipt sharing lacks an identifier or fails', async () => {
    const { result } = renderHook(() => useUtilityHistoryActions({ refetch }));

    await act(async () => {
      await result.current.handleShareReceipt(
        createTransaction({ customer_identifier: '', phone_number: null })
      );
    });

    expect(mockShareUtilityReceipt).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      'Cannot Share',
      'Customer identifier is missing for this transaction.'
    );

    mockShareUtilityReceipt.mockRejectedValueOnce(new Error('share failed'));
    await act(async () => {
      await result.current.handleShareReceipt(createTransaction());
    });

    expect(console.error).toHaveBeenCalledWith(
      'Failed to share utility receipt:',
      expect.any(Error)
    );
    expect(Alert.alert).toHaveBeenCalledWith(
      'Share Failed',
      'Could not generate the receipt PDF. Please try again.'
    );
  });

  it('syncs payments, blocks concurrent syncs, and handles failure refetches', async () => {
    const sync = deferred<Awaited<ReturnType<typeof confirmVtuCheckout>>>();
    mockConfirmVtuCheckout.mockReturnValueOnce(sync.promise);
    const transaction = createTransaction({ status: 'failed' });
    const { result } = renderHook(() => useUtilityHistoryActions({ refetch }));

    act(() => {
      void result.current.handleSyncPayment(transaction);
      void result.current.handleSyncPayment(transaction);
    });

    expect(mockConfirmVtuCheckout).toHaveBeenCalledTimes(1);
    expect(mockConfirmVtuCheckout).toHaveBeenCalledWith({
      gateway: 'paystack',
      reference: 'PAY-123',
    });
    await waitFor(() =>
      expect(result.current.syncingTransactionId).toBe('tx-1')
    );

    await act(async () => {
      sync.resolve({
        amount: 2500,
        reference: 'PAY-123',
        status: 'successful',
      });
      await sync.promise;
    });

    expect(refetch).toHaveBeenCalledTimes(1);
    expect(Alert.alert).toHaveBeenCalledWith(
      'Payment Synced',
      'This utility payment has been reconciled.'
    );
    await waitFor(() => expect(result.current.syncingTransactionId).toBeNull());

    mockConfirmVtuCheckout.mockRejectedValueOnce(new Error('processing'));
    await act(async () => {
      await result.current.handleSyncPayment(transaction);
    });

    expect(refetch).toHaveBeenCalledTimes(2);
    expect(Alert.alert).toHaveBeenCalledWith(
      'Sync Failed',
      'This payment is already being reconciled. Please check again shortly.'
    );
  });

  it('shows a processing alert when payment sync is not yet fulfilled', async () => {
    mockConfirmVtuCheckout.mockResolvedValueOnce({
      amount: 2500,
      reference: 'PAY-123',
      status: 'processing',
    });
    const { result } = renderHook(() => useUtilityHistoryActions({ refetch }));

    await act(async () => {
      await result.current.handleSyncPayment(createTransaction());
    });

    expect(refetch).toHaveBeenCalledTimes(1);
    expect(Alert.alert).toHaveBeenCalledWith(
      'Still Processing',
      'The payment is confirmed, but utility fulfillment is still processing.'
    );
  });

  it('alerts when sync payment information is missing', async () => {
    const { result } = renderHook(() => useUtilityHistoryActions({ refetch }));

    await act(async () => {
      await result.current.handleSyncPayment(
        createTransaction({ payment_gateway: null })
      );
    });

    expect(mockConfirmVtuCheckout).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      'Cannot Sync',
      'Cannot sync: missing payment information.'
    );
  });
});
