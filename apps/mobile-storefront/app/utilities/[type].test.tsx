import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import UtilityPurchaseScreen from '@/app/utilities/[type]';
import type {
  UtilityHistoryFilter,
  VTUHistoryTransaction,
} from '@/hooks/use-vtu-history';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockCanGoBack = jest.fn();
const mockInvalidateQueries = jest.fn();
type UtilityRouteParams = {
  amount?: string;
  cashbackAmount?: string;
  cashbackNewBalance?: string;
  customerIdentifier?: string;
  paymentStatus?: string;
  reference?: string;
  repeatAmount?: string;
  repeatBillerName?: string;
  repeatBillItemIdentifier?: string;
  repeatCustomerIdentifier?: string;
  repeatDataPlanCode?: string;
  repeatNetworkProvider?: string;
  repeatPhoneNumber?: string;
  repeatVerified?: string;
  type: string;
  voucherPin?: string;
};
const mockUseLocalSearchParams = jest.fn<() => UtilityRouteParams>(() => ({
  type: 'power',
}));
type MockVTUHistoryResult = {
  data: VTUHistoryTransaction[];
  error: Error | null;
  isLoading: boolean;
};
type MockUseVTUHistory = (
  filter: UtilityHistoryFilter,
  limit: number
) => MockVTUHistoryResult;
const mockUseVTUHistory = jest.fn<MockUseVTUHistory>();

function createHistoryResult(
  overrides: Partial<MockVTUHistoryResult> = {}
): MockVTUHistoryResult {
  return {
    data: [],
    error: null,
    isLoading: false,
    ...overrides,
  };
}

function createHistoryTransaction(
  overrides: Partial<VTUHistoryTransaction> = {}
): VTUHistoryTransaction {
  return {
    amount: 2500,
    biller_item_code: 'KUD-ELE-EKED-002',
    biller_name: 'EKEDC NG',
    created_at: '2026-04-08T12:00:00.000Z',
    customer_identifier: '43901766923',
    id: 'tx-1',
    request_reference: 'ref-1',
    status: 'successful',
    type: 'electricity',
    ...overrides,
  };
}

jest.mock('expo-router', () => ({
  Stack: {
    Screen: () => null,
  },
  useLocalSearchParams: () => mockUseLocalSearchParams(),
  useRouter: () => ({
    back: mockBack,
    canGoBack: mockCanGoBack,
    push: mockPush,
    replace: mockReplace,
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
}));

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

jest.mock('@/components/utilities/AirtimeForm', () => {
  const { Text } =
    jest.requireActual<typeof import('react-native')>('react-native');

  return {
    AirtimeForm: ({ initialPhoneNumber }: { initialPhoneNumber?: string }) => (
      <Text>{`Airtime form ${initialPhoneNumber ?? ''}`}</Text>
    ),
  };
});

jest.mock('@/components/utilities/BillForm', () => {
  const { Text } =
    jest.requireActual<typeof import('react-native')>('react-native');

  return {
    BillForm: ({
      initialAmount,
      initialCustomerIdentifier,
      isRepeatPaymentReady,
      type,
    }: {
      initialAmount?: string;
      initialCustomerIdentifier?: string;
      isRepeatPaymentReady?: boolean;
      type: string;
    }) => {
      const formText = [
        'Bill form',
        type,
        initialCustomerIdentifier,
        initialAmount,
        isRepeatPaymentReady ? 'repeat-ready' : undefined,
      ]
        .filter(Boolean)
        .join(' ');

      return <Text>{formText}</Text>;
    },
  };
});

jest.mock('@/components/utilities/DataForm', () => {
  const { Text } =
    jest.requireActual<typeof import('react-native')>('react-native');

  return {
    DataForm: ({ initialPhoneNumber }: { initialPhoneNumber?: string }) => (
      <Text>{`Data form ${initialPhoneNumber ?? ''}`}</Text>
    ),
  };
});

jest.mock('@/components/utilities/PurchaseSuccess', () => {
  const { Text } =
    jest.requireActual<typeof import('react-native')>('react-native');

  return {
    PurchaseSuccess: ({
      customerIdentifier,
      status,
    }: {
      customerIdentifier?: string;
      status?: string;
    }) => (
      <Text>{`Purchase success ${status ?? 'successful'} ${customerIdentifier ?? ''}`}</Text>
    ),
  };
});

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: (
    selector: (state: {
      customer: { id: string } | null;
      session: { access_token: string } | null;
    }) => unknown
  ) =>
    selector({
      customer: { id: 'customer-1' },
      session: { access_token: 'token' },
    }),
}));

jest.mock('@/hooks/use-keyboard', () => ({
  useKeyboard: () => ({
    isKeyboardVisible: false,
  }),
}));

jest.mock('@/hooks/use-vtu-history', () => ({
  useVTUHistory: (filter: UtilityHistoryFilter, limit: number) =>
    mockUseVTUHistory(filter, limit),
}));

describe('UtilityPurchaseScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCanGoBack.mockReturnValue(true);
    mockUseLocalSearchParams.mockReturnValue({ type: 'power' });
    mockUseVTUHistory.mockReturnValue(createHistoryResult());
  });

  it('shows utility submenus and switches between utility types locally', () => {
    render(<UtilityPurchaseScreen />);

    expect(screen.getByText('Electricity')).toBeOnTheScreen();
    fireEvent.press(screen.getByLabelText('View utility history'));
    expect(mockPush).toHaveBeenCalledWith('/utilities/history?type=power');

    expect(screen.getByText('Airtime')).toBeOnTheScreen();
    expect(screen.getByText('Data')).toBeOnTheScreen();
    expect(screen.getByText('TV')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Power utility service')
    ).toHaveAccessibilityState({
      selected: true,
    });

    fireEvent.press(screen.getByLabelText('Data utility service'));

    expect(mockReplace).not.toHaveBeenCalledWith('/utilities/data');
    expect(screen.getByText('Data form')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Data utility service')
    ).toHaveAccessibilityState({
      selected: true,
    });
  });

  it('renders utility submenus on the airtime screen', () => {
    mockUseLocalSearchParams.mockReturnValue({ type: 'airtime' });

    render(<UtilityPurchaseScreen />);

    expect(screen.getByText('Airtime form')).toBeOnTheScreen();
    expect(screen.getByTestId('utility-type-tabs')).toBeOnTheScreen();
    expect(screen.getByLabelText('Data utility service')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Airtime utility service')
    ).toHaveAccessibilityState({
      selected: true,
    });
  });

  it('switches to airtime locally while keeping utility submenus visible', () => {
    render(<UtilityPurchaseScreen />);

    fireEvent.press(screen.getByLabelText('Airtime utility service'));

    expect(mockReplace).not.toHaveBeenCalledWith('/utilities/airtime');
    expect(screen.getByTestId('utility-type-tabs')).toBeOnTheScreen();
    expect(screen.getByText('Airtime form')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Airtime utility service')
    ).toHaveAccessibilityState({
      selected: true,
    });
  });

  it('uses the header back button for utility screens', () => {
    render(<UtilityPurchaseScreen />);

    fireEvent.press(screen.getByLabelText('Go back'));

    expect(mockBack).toHaveBeenCalled();
  });

  it('shows the meter number on a processing payment result', () => {
    mockUseLocalSearchParams.mockReturnValue({
      amount: '1000',
      customerIdentifier: '43901766923',
      paymentStatus: 'processing',
      reference: 'ref-123',
      type: 'power',
    });

    render(<UtilityPurchaseScreen />);

    expect(
      screen.getByText('Purchase success processing 43901766923')
    ).toBeOnTheScreen();
  });

  it('refreshes the wallet cache when a utility success includes cashback', async () => {
    mockUseLocalSearchParams.mockReturnValue({
      amount: '1000',
      cashbackAmount: '50',
      cashbackNewBalance: '1200',
      customerIdentifier: '08031234567',
      paymentStatus: 'successful',
      reference: 'ref-cashback',
      type: 'airtime',
    });

    render(<UtilityPurchaseScreen />);

    await waitFor(() => {
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ['wallet', 'data', 'customer-1'],
      });
    });
  });

  it('prefills the current form from the last successful transaction quick action', () => {
    mockUseVTUHistory.mockReturnValue({
      ...createHistoryResult(),
      data: [createHistoryTransaction()],
    });

    render(<UtilityPurchaseScreen />);

    fireEvent.press(
      screen.getByLabelText('Repeat last Electricity transaction')
    );

    expect(
      screen.getByText('Bill form power 43901766923 2500 repeat-ready')
    ).toBeOnTheScreen();
  });

  it('does not show quick repeat for the latest failed transaction', () => {
    mockUseVTUHistory.mockReturnValue(
      createHistoryResult({
        data: [createHistoryTransaction({ status: 'failed' })],
      })
    );

    render(<UtilityPurchaseScreen />);

    expect(
      screen.queryByLabelText('Repeat last Electricity transaction')
    ).toBeNull();
  });

  it('does not show quick repeat when history is empty', () => {
    mockUseVTUHistory.mockReturnValue(createHistoryResult({ data: [] }));

    render(<UtilityPurchaseScreen />);

    expect(
      screen.queryByLabelText('Repeat last Electricity transaction')
    ).toBeNull();
  });

  it('does not show quick repeat for a transaction outside the current utility type', () => {
    mockUseVTUHistory.mockReturnValue(
      createHistoryResult({
        data: [
          createHistoryTransaction({
            biller_name: null,
            customer_identifier: null,
            phone_number: '08031234567',
            type: 'airtime',
          }),
        ],
      })
    );

    render(<UtilityPurchaseScreen />);

    expect(
      screen.queryByLabelText('Repeat last Electricity transaction')
    ).toBeNull();
  });

  it('clears quick-repeat defaults when switching utility types', async () => {
    mockUseVTUHistory.mockReturnValue(
      createHistoryResult({
        data: [createHistoryTransaction()],
      })
    );

    render(<UtilityPurchaseScreen />);

    fireEvent.press(
      screen.getByLabelText('Repeat last Electricity transaction')
    );
    expect(
      screen.getByText('Bill form power 43901766923 2500 repeat-ready')
    ).toBeOnTheScreen();

    fireEvent.press(screen.getByLabelText('TV utility service'));

    await waitFor(() => {
      expect(screen.queryByText(/repeat-ready/)).toBeNull();
    });
  });

  it('shows a quiet loading state instead of quick repeat while history loads', () => {
    mockUseVTUHistory.mockReturnValue(
      createHistoryResult({
        data: [createHistoryTransaction()],
        isLoading: true,
      })
    );

    render(<UtilityPurchaseScreen />);

    expect(
      screen.queryByLabelText('Repeat last Electricity transaction')
    ).toBeNull();
    expect(
      screen.getByText('Checking recent Electricity transactions...')
    ).toBeOnTheScreen();
  });

  it('shows a quiet error state instead of quick repeat when history fails', () => {
    mockUseVTUHistory.mockReturnValue(
      createHistoryResult({
        data: [createHistoryTransaction()],
        error: new Error('History failed'),
      })
    );

    render(<UtilityPurchaseScreen />);

    expect(
      screen.queryByLabelText('Repeat last Electricity transaction')
    ).toBeNull();
    expect(
      screen.getByText('Recent Electricity transactions unavailable.')
    ).toBeOnTheScreen();
  });

  it('passes verified repeat route params straight into the bill payment step', () => {
    mockUseLocalSearchParams.mockReturnValue({
      repeatAmount: '1000',
      repeatBillerName: 'EKEDC NG',
      repeatBillItemIdentifier: 'KUD-ELE-EKED-002',
      repeatCustomerIdentifier: '43901766923',
      repeatVerified: '1',
      type: 'power',
    });

    render(<UtilityPurchaseScreen />);

    expect(
      screen.getByText('Bill form power 43901766923 1000 repeat-ready')
    ).toBeOnTheScreen();
  });

  it('does not carry route repeat params into another utility tab', async () => {
    mockUseLocalSearchParams.mockReturnValue({
      repeatAmount: '1000',
      repeatBillerName: 'EKEDC NG',
      repeatBillItemIdentifier: 'KUD-ELE-EKED-002',
      repeatCustomerIdentifier: '43901766923',
      repeatVerified: '1',
      type: 'power',
    });

    render(<UtilityPurchaseScreen />);

    expect(
      screen.getByText('Bill form power 43901766923 1000 repeat-ready')
    ).toBeOnTheScreen();

    fireEvent.press(screen.getByLabelText('TV utility service'));

    await waitFor(() => {
      expect(screen.getByText('Bill form tv')).toBeOnTheScreen();
    });
    expect(screen.queryByText(/repeat-ready/)).toBeNull();
  });
});
