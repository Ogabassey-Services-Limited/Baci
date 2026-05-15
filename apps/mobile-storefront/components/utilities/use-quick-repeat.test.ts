import { jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import { useQuickRepeat } from '@/components/utilities/use-quick-repeat';
import type { VTUHistoryTransaction } from '@/hooks/use-vtu-history';
import { useVTUHistory } from '@/hooks/use-vtu-history';
import type { UtilityRepeatRecipient } from '@/lib/utility-repeat';

jest.mock('@/hooks/use-vtu-history', () => ({
  useVTUHistory: jest.fn(),
}));

const mockUseVTUHistory = jest.mocked(useVTUHistory);
type MockVTUHistoryReturn = ReturnType<typeof useVTUHistory>;

function mockVTUHistoryReturn(overrides: Partial<MockVTUHistoryReturn> = {}) {
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

  it('maps successful matching transactions into recent recipients', () => {
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
        routeType: null,
      })
    );

    expect(mockUseVTUHistory).toHaveBeenCalledWith('airtime', 5);
    expect(result.current.recentRecipients).toHaveLength(1);
    expect(result.current.recentRecipients[0]).toEqual(
      expect.objectContaining({
        id: 'tx-success',
        identifier: '08012345678',
        identifierLabel: 'Phone Number',
      })
    );
  });

  it('uses route repeat defaults when a non-null route type matches the current type', () => {
    const { result } = renderHook(() =>
      useQuickRepeat({
        currentType: 'data',
        historyFilter: 'data',
        repeatAmount: 1500,
        repeatDataPlanCode: 'daily-1gb',
        repeatNetworkProvider: 'mtn',
        repeatPhoneNumber: '08012345678',
        repeatVerified: true,
        routeType: 'data',
      })
    );

    expect(result.current.repeatDefaults).toEqual({
      amount: '1500',
      dataPlanCode: 'daily-1gb',
      isVerified: true,
      networkProvider: 'mtn',
      phoneNumber: '08012345678',
    });
    expect(result.current.isRepeatPaymentReady).toBe(true);
  });

  it('forwards a verified meter-owner name from the route into repeat defaults', () => {
    const { result } = renderHook(() =>
      useQuickRepeat({
        currentType: 'power',
        historyFilter: 'power',
        repeatAmount: 2000,
        repeatBillerName: 'EKEDC NG',
        repeatBillItemIdentifier: 'KUD-ELE-EKED-001',
        repeatCustomerIdentifier: '43901766923',
        repeatCustomerName: 'JANE CUSTOMER',
        repeatVerified: true,
        routeType: 'power',
      })
    );

    expect(result.current.repeatDefaults).toMatchObject({
      customerIdentifier: '43901766923',
      customerName: 'JANE CUSTOMER',
    });
  });

  it('returns no recent recipients when recent history is empty', () => {
    mockVTUHistoryReturn({ data: [] });

    const { result } = renderHook(() =>
      useQuickRepeat({
        currentType: 'airtime',
        historyFilter: 'airtime',
        routeType: null,
      })
    );

    expect(result.current.recentRecipients).toEqual([]);
  });

  it('returns no recent recipients when every recent transaction failed', () => {
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
        routeType: null,
      })
    );

    expect(result.current.recentRecipients).toEqual([]);
  });

  it('populates repeat defaults and bumps repeat revision when a recipient is selected', () => {
    const recipient: UtilityRepeatRecipient = {
      id: 'txn-1',
      title: 'OLUROTIMI ADEBANJO',
      identifierLabel: 'Meter Number',
      identifier: '43901766923',
      meta: '₦2,500',
      defaults: {
        amount: '2500',
        billerName: 'EKEDC NG',
        billItemIdentifier: 'KUD-ELE-EKED-002',
        customerIdentifier: '43901766923',
        customerName: 'OLUROTIMI ADEBANJO',
        isVerified: true,
      },
    };

    const { result, rerender } = renderHook(() =>
      useQuickRepeat({
        currentType: 'power',
        historyFilter: 'power',
        routeType: null,
      })
    );

    expect(result.current.repeatDefaults.isVerified).toBeFalsy();
    const initialRevision = result.current.repeatRevision;

    act(() => {
      result.current.handleRecipientSelect(recipient);
    });

    expect(result.current.repeatDefaults).toMatchObject({
      amount: '2500',
      customerIdentifier: '43901766923',
      isVerified: true,
    });
    expect(result.current.repeatRevision).toBe(initialRevision + 1);

    rerender(undefined);

    expect(result.current.repeatDefaults.isVerified).toBe(true);
  });
});
