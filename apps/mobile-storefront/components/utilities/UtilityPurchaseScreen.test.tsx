import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import UtilityPurchaseScreen from '@/app/utilities/[type]';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockCanGoBack = jest.fn();
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
const mockUseVTUHistory = jest.fn();

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
    }) => (
      <Text>
        {`Bill form ${type} ${initialCustomerIdentifier ?? ''} ${
          initialAmount ?? ''
        }${isRepeatPaymentReady ? ' repeat-ready' : ''}`}
      </Text>
    ),
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
    selector: (state: { session: { access_token: string } | null }) => unknown
  ) => selector({ session: { access_token: 'token' } }),
}));

jest.mock('@/hooks/use-keyboard', () => ({
  useKeyboard: () => ({
    isKeyboardVisible: false,
  }),
}));

jest.mock('@/hooks/use-vtu-history', () => ({
  useVTUHistory: (...args: unknown[]) => mockUseVTUHistory(...args),
}));

describe('UtilityPurchaseScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCanGoBack.mockReturnValue(true);
    mockUseLocalSearchParams.mockReturnValue({ type: 'power' });
    mockUseVTUHistory.mockReturnValue({ data: [] });
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

  it('prefills the current form from the last successful transaction quick action', () => {
    mockUseVTUHistory.mockReturnValue({
      data: [
        {
          id: 'tx-1',
          amount: 2500,
          biller_name: 'EKEDC NG',
          customer_identifier: '43901766923',
          request_reference: 'ref-1',
          status: 'successful',
          type: 'electricity',
        },
      ],
    });

    render(<UtilityPurchaseScreen />);

    fireEvent.press(
      screen.getByLabelText('Repeat last Electricity transaction')
    );

    expect(
      screen.getByText('Bill form power 43901766923 2500 repeat-ready')
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
});
