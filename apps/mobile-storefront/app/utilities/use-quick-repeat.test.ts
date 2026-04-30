import { jest } from '@jest/globals';
import { renderHook } from '@testing-library/react-native';
import { useQuickRepeat } from '@/app/utilities/use-quick-repeat';
import type { VTUHistoryTransaction } from '@/hooks/use-vtu-history';
import { useVTUHistory } from '@/hooks/use-vtu-history';

jest.mock('@/hooks/use-vtu-history', () => ({
  useVTUHistory: jest.fn(),
}));

const mockUseVTUHistory = jest.mocked(useVTUHistory);
type MockVTUHistoryReturn = ReturnType<typeof useVTUHistory>;

function mockVTUHistoryReturn(
  overrides: Partial<MockVTUHistoryReturn> = {}
) {
  mockUseVTUHistory.mockReturnValue({
    data: [],
    error: null,
    isLoading: false,
    ...overrides,
  } as MockVTUHistoryReturn);
}

function createTransaction(
  overrides: Partial<VTUHistoryTransaction> = {}
): VTUHistoryTransaction {
  return {
    amount: 1000,
    created_at: '2026-04-08T12:00:00.000Z',
    id: 'tx-1',
    payment_gateway: 'paystack',
    payment_reference: 'PAY-123',
    payment_status: 'completed',
    phone_number: '08012345678',
    request_reference: 'VTU-123',
    status: 'successful',
    type: 'airtime',
    ...overrides,
  };
}

describe('useQuickRepeat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVTUHistoryReturn();
  });

  it('selects the most recent successful matching transaction from recent history', () => {
    const failedLatest = createTransaction({
      id: 'tx-failed',
      status: 'failed',
    });
    const successfulPrevious = createTransaction({
      id: 'tx-success',
      status: 'successful',
    });
    mockVTUHistoryReturn({
      data: [failedLatest, successfulPrevious],
      error: null,
      isLoading: false,
    });

    const { result } = renderHook(() =>
      useQuickRepeat({
        currentType: 'airtime',
        historyFilter: 'airtime',
        isKeyboardVisible: false,
        routeType: null,
        title: 'airtime',
      })
    );

    expect(mockUseVTUHistory).toHaveBeenCalledWith('airtime', 5);
    expect(result.current.lastTransaction?.id).toBe('tx-success');
    expect(result.current.showQuickRepeat).toBe(true);
  });

  it('returns a loading notice while recent transactions are loading', () => {
    mockVTUHistoryReturn({
      data: undefined,
      error: null,
      isLoading: true,
    });

    const { result } = renderHook(() =>
      useQuickRepeat({
        currentType: 'data',
        historyFilter: 'data',
        isKeyboardVisible: false,
        routeType: null,
        title: 'data',
      })
    );

    expect(result.current.quickRepeatNotice).toBe(
      'Checking recent data transactions...'
    );
    expect(result.current.showQuickRepeat).toBe(false);
  });

  it('returns an error notice when recent transactions fail to load', () => {
    mockVTUHistoryReturn({
      data: [createTransaction()],
      error: new Error('history failed'),
      isLoading: false,
    });

    const { result } = renderHook(() =>
      useQuickRepeat({
        currentType: 'airtime',
        historyFilter: 'airtime',
        isKeyboardVisible: false,
        routeType: null,
        title: 'airtime',
      })
    );

    expect(result.current.quickRepeatNotice).toBe(
      'Recent airtime transactions unavailable.'
    );
    expect(result.current.lastTransaction?.id).toBe('tx-1');
    expect(result.current.showQuickRepeat).toBe(false);
  });

  it('does not show quick repeat when recent history is empty', () => {
    mockVTUHistoryReturn({ data: [] });

    const { result } = renderHook(() =>
      useQuickRepeat({
        currentType: 'airtime',
        historyFilter: 'airtime',
        isKeyboardVisible: false,
        routeType: null,
        title: 'airtime',
      })
    );

    expect(result.current.lastTransaction).toBeNull();
    expect(result.current.quickRepeatNotice).toBeNull();
    expect(result.current.showQuickRepeat).toBe(false);
  });

  it('does not show quick repeat when every recent transaction failed', () => {
    mockVTUHistoryReturn({
      data: [
        createTransaction({ id: 'tx-failed-1', status: 'failed' }),
        createTransaction({ id: 'tx-failed-2', status: 'failed' }),
      ],
    });

    const { result } = renderHook(() =>
      useQuickRepeat({
        currentType: 'airtime',
        historyFilter: 'airtime',
        isKeyboardVisible: false,
        routeType: null,
        title: 'airtime',
      })
    );

    expect(result.current.lastTransaction).toBeNull();
    expect(result.current.quickRepeatNotice).toBeNull();
    expect(result.current.showQuickRepeat).toBe(false);
  });
});
