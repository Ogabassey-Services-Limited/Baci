import { renderHook } from '@testing-library/react-native';
import type { VTUHistoryTransaction } from '@/hooks/use-vtu-history';
import { useVTUHistory } from '@/hooks/use-vtu-history';
import { useQuickRepeat } from './use-quick-repeat';

jest.mock('@/hooks/use-vtu-history', () => ({
  useVTUHistory: jest.fn(),
}));

const mockUseVTUHistory = jest.mocked(useVTUHistory);

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
    mockUseVTUHistory.mockReturnValue({
      data: [],
      error: null,
      isLoading: false,
    } as unknown as ReturnType<typeof useVTUHistory>);
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
    mockUseVTUHistory.mockReturnValue({
      data: [failedLatest, successfulPrevious],
      error: null,
      isLoading: false,
    } as unknown as ReturnType<typeof useVTUHistory>);

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
    mockUseVTUHistory.mockReturnValue({
      data: undefined,
      error: null,
      isLoading: true,
    } as unknown as ReturnType<typeof useVTUHistory>);

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
});
