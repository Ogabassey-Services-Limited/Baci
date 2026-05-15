import { jest } from '@jest/globals';
import {
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';
import { Alert } from 'react-native';
import type { ExtractState } from 'zustand/vanilla';
import type { UtilityRepeatRecipient } from '@/lib/utility-repeat';
import { VtuPaymentStillProcessingError } from '@/lib/vtu-checkout';
import type { useAuthStore as useAuthStoreType } from '@/stores/auth-store';
import { DataForm } from './DataForm';

type AuthStoreState = ExtractState<typeof useAuthStoreType>;
type AuthStorePartial = Partial<AuthStoreState>;

const mockRouterPush = jest.fn();
const mockUseVTUBillers = jest.fn();
const mockChargeSavedVtuCard =
  jest.fn<
    (...args: unknown[]) => Promise<{
      amount?: number;
      authorization_url?: string;
      cashback?: { amount: number; newBalance: number };
      gateway?: 'paystack';
      requires_authorization?: true;
      reference: string;
      status?: 'processing';
      voucherPin?: string;
    }>
  >();
const mockInitializeVtuCheckout =
  jest.fn<
    (...args: unknown[]) => Promise<{
      authorization_url: string;
      gateway: 'paystack';
      reference: string;
    }>
  >();
const mockIsSavedVtuCardChargeProcessing = jest.fn();
const mockRequiresSavedVtuCardAuthorization = jest.fn();
const mockUseUtilityPayment = jest.fn();
const mockWaitForVtuConfirmation =
  jest.fn<
    (...args: unknown[]) => Promise<{
      amount?: number;
      cashback?: { amount: number; newBalance: number };
      reference: string;
      voucherPin?: string;
    }>
  >();
const mockAuthStoreState = {
  customer: null,
  session: null,
  user: null,
} satisfies AuthStorePartial;

const recentRecipient: UtilityRepeatRecipient = {
  id: 'data-1',
  title: 'MTN',
  identifierLabel: 'Phone Number',
  identifier: '08012345678',
  meta: '₦1,000',
  defaults: {
    amount: '1000',
    dataPlanCode: 'mtn-1gb',
    isVerified: true,
    networkProvider: 'mtn',
    phoneNumber: '08012345678',
  },
};

jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockRouterPush(...args),
  },
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

jest.mock('@/hooks/use-keyboard', () => ({
  useKeyboard: () => ({
    dismissKeyboard: jest.fn(),
    isKeyboardVisible: false,
    keyboardHeight: 0,
  }),
}));

jest.mock('@/hooks/use-utility-payment', () => ({
  useUtilityPayment: () => mockUseUtilityPayment(),
}));

jest.mock('@/hooks/use-vtu-billers', () => ({
  useVTUBillers: (...args: unknown[]) => mockUseVTUBillers(...args),
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: <Selected,>(selector: (state: AuthStorePartial) => Selected) =>
    selector(mockAuthStoreState),
}));

jest.mock('@/lib/vtu-checkout', () => {
  const actual =
    jest.requireActual<typeof import('@/lib/vtu-checkout')>(
      '@/lib/vtu-checkout'
    );

  return {
    ...actual,
    chargeSavedVtuCard: (...args: unknown[]) => mockChargeSavedVtuCard(...args),
    initializeVtuCheckout: (...args: unknown[]) =>
      mockInitializeVtuCheckout(...args),
    isSavedVtuCardChargeProcessing: (...args: unknown[]) =>
      mockIsSavedVtuCardChargeProcessing(...args),
    requiresSavedVtuCardAuthorization: (...args: unknown[]) =>
      mockRequiresSavedVtuCardAuthorization(...args),
    waitForVtuConfirmation: (...args: unknown[]) =>
      mockWaitForVtuConfirmation(...args),
  };
});

jest.mock('./UtilityPaymentOptions', () => {
  const { Text } =
    jest.requireActual<typeof import('react-native')>('react-native');

  return {
    UtilityPaymentOptions: () => <Text>Payment options</Text>,
  };
});

describe('DataForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseVTUBillers.mockReturnValue({
      data: [
        {
          billerId: 'mtn-1gb',
          billerName: 'MTN 1GB Data',
          billerType: 'Internet Data',
          categoryId: 'data',
          categoryName: 'Internet Data',
        },
        {
          billerId: 'airtel-1gb',
          billerName: 'Airtel 1GB Data',
          billerType: 'Internet Data',
          categoryId: 'data',
          categoryName: 'Internet Data',
        },
      ],
      error: null,
      isError: false,
      isLoading: false,
    });
    mockInitializeVtuCheckout.mockResolvedValue({
      authorization_url: 'https://checkout.paystack.com/test',
      gateway: 'paystack',
      reference: 'VTU-DATA-123',
    });
    mockChargeSavedVtuCard.mockResolvedValue({
      amount: 1000,
      reference: 'VTU-CARD-123',
      voucherPin: 'token-123',
    });
    mockIsSavedVtuCardChargeProcessing.mockReturnValue(false);
    mockRequiresSavedVtuCardAuthorization.mockReturnValue(false);
    mockWaitForVtuConfirmation.mockResolvedValue({
      amount: 1000,
      reference: 'VTU-CARD-123',
      voucherPin: 'token-123',
    });
    mockUseUtilityPayment.mockReturnValue({
      cards: [],
      isLoadingCards: false,
      selectedGateway: 'paystack',
      selectedSavedCardId: null,
      selectGateway: jest.fn(),
      selectSavedCard: jest.fn(),
      supportedGateways: ['paystack', 'korapay'],
    });
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses the biller picker pattern and collapses the selected data bundle', () => {
    const onSuccessMock = jest.fn();
    render(<DataForm onSuccess={onSuccessMock} />);

    expect(screen.getByText('Phone Number')).toBeOnTheScreen();
    expect(screen.queryByText('Select Provider')).toBeNull();
    expect(screen.getByText('Select Data Bundle')).toBeOnTheScreen();
    expect(screen.getByText('MTN 1GB Data')).toBeOnTheScreen();
    expect(screen.getByText('Airtel 1GB Data')).toBeOnTheScreen();

    fireEvent.press(screen.getByText('MTN 1GB Data'));

    expect(screen.getByText('Data Bundle')).toBeOnTheScreen();
    expect(screen.getByText('MTN 1GB Data')).toBeOnTheScreen();
    expect(screen.queryByText('Airtel 1GB Data')).toBeNull();
    expect(screen.getByLabelText('Change selected provider')).toBeOnTheScreen();
  });

  it('renders recent recipients under the phone number field', async () => {
    const user = userEvent.setup();
    const onSelectRecentRecipient = jest.fn();

    render(
      <DataForm
        onSuccess={jest.fn()}
        recentRecipients={[recentRecipient]}
        onSelectRecentRecipient={onSelectRecentRecipient}
      />
    );

    expect(screen.getByText('Select Beneficiary')).toBeOnTheScreen();
    expect(screen.getByText('Phone Number: 08012345678')).toBeOnTheScreen();

    await user.press(
      screen.getByLabelText('Select MTN, Phone Number 08012345678')
    );

    expect(onSelectRecentRecipient).toHaveBeenCalledWith(recentRecipient);
  });

  it('shows validation feedback when required data purchase fields are missing', () => {
    render(<DataForm onSuccess={jest.fn()} />);

    fireEvent.press(screen.getByText('Continue to Payment'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Missing Information',
      'Please enter a phone number and choose a data bundle.'
    );
  });

  it('shows loading state from the biller fetch', () => {
    mockUseVTUBillers.mockReturnValueOnce({
      data: undefined,
      error: null,
      isError: false,
      isLoading: true,
    });
    render(<DataForm onSuccess={jest.fn()} />);

    expect(screen.getByText('Loading providers...')).toBeOnTheScreen();
    expect(screen.queryByText('MTN 1GB Data')).toBeNull();
  });

  it('shows empty data bundle state from the biller fetch', () => {
    mockUseVTUBillers.mockReturnValueOnce({
      data: [],
      error: null,
      isError: false,
      isLoading: false,
    });
    render(<DataForm onSuccess={jest.fn()} />);

    expect(screen.getByText('No data bundles available')).toBeOnTheScreen();
  });

  it('shows error state from the biller fetch', () => {
    mockUseVTUBillers.mockReturnValueOnce({
      data: undefined,
      error: new Error('Could not load data bundles.'),
      isError: true,
      isLoading: false,
    });
    render(<DataForm onSuccess={jest.fn()} />);

    expect(screen.getByText('Could not load data bundles.')).toBeOnTheScreen();
    expect(screen.queryByText('No data bundles available')).toBeNull();
  });

  it('submits selected data bundle details to checkout', async () => {
    const onSuccessMock = jest.fn();
    render(<DataForm onSuccess={onSuccessMock} />);

    fireEvent.changeText(screen.getByLabelText('Phone Number'), '08031234567');
    fireEvent.press(screen.getByText('MTN 1GB Data'));
    fireEvent.changeText(screen.getByLabelText('Amount'), '1000');
    fireEvent.press(screen.getByText('Continue to Payment'));

    await waitFor(() => {
      expect(mockInitializeVtuCheckout).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 1000,
          dataPlanCode: 'mtn-1gb',
          gateway: 'paystack',
          networkProvider: 'mtn',
          phoneNumber: '08031234567',
          type: 'data',
        })
      );
      expect(mockRouterPush).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: '/payment-gateway',
          params: expect.objectContaining({
            customerIdentifier: '08031234567',
            reference: 'VTU-DATA-123',
            utilityType: 'data',
          }),
        })
      );
    });
    expect(onSuccessMock).not.toHaveBeenCalled();
  });

  it('calls onSuccess after a saved-card data purchase succeeds', async () => {
    const onSuccessMock = jest.fn();
    mockUseUtilityPayment.mockReturnValue({
      cards: [],
      isLoadingCards: false,
      // Saved-card VTU charges are processed through Paystack even when no
      // manual gateway is selected.
      selectedGateway: null,
      selectedSavedCardId: 'saved-card-1',
      selectGateway: jest.fn(),
      selectSavedCard: jest.fn(),
      supportedGateways: ['paystack', 'korapay'],
    });
    mockChargeSavedVtuCard.mockResolvedValueOnce({
      amount: 1000,
      cashback: { amount: 5, newBalance: 25 },
      reference: 'VTU-CARD-123',
      voucherPin: 'token-123',
    });
    render(<DataForm onSuccess={onSuccessMock} />);

    fireEvent.press(screen.getByText('MTN 1GB Data'));
    fireEvent.changeText(screen.getByLabelText('Phone Number'), '08031234567');
    fireEvent.changeText(screen.getByLabelText('Amount'), '1000');
    fireEvent.press(screen.getByText('Pay ₦1,000'));

    await waitFor(() => {
      expect(mockChargeSavedVtuCard).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 1000,
          dataPlanCode: 'mtn-1gb',
          networkProvider: 'mtn',
          phoneNumber: '08031234567',
          savedPaymentMethodId: 'saved-card-1',
          type: 'data',
        })
      );
      expect(onSuccessMock).toHaveBeenCalledWith({
        amount: 1000,
        cashback: { amount: 5, newBalance: 25 },
        reference: 'VTU-CARD-123',
        voucherPin: 'token-123',
      });
    });
  });

  it('routes saved-card data purchases through authorization when required', async () => {
    mockUseUtilityPayment.mockReturnValue({
      cards: [],
      isLoadingCards: false,
      selectedGateway: null,
      selectedSavedCardId: 'saved-card-1',
      selectGateway: jest.fn(),
      selectSavedCard: jest.fn(),
      supportedGateways: ['paystack', 'korapay'],
    });
    mockRequiresSavedVtuCardAuthorization.mockReturnValueOnce(true);
    mockChargeSavedVtuCard.mockResolvedValueOnce({
      authorization_url: 'https://checkout.paystack.com/authorize-card',
      gateway: 'paystack',
      reference: 'VTU-CARD-AUTH-123',
      requires_authorization: true,
    });
    render(<DataForm onSuccess={jest.fn()} />);

    fireEvent.press(screen.getByText('MTN 1GB Data'));
    fireEvent.changeText(screen.getByLabelText('Phone Number'), '08031234567');
    fireEvent.changeText(screen.getByLabelText('Amount'), '1000');
    fireEvent.press(screen.getByText('Pay ₦1,000'));

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith({
        pathname: '/payment-gateway',
        params: expect.objectContaining({
          amount: '1000',
          authorizationUrl: 'https://checkout.paystack.com/authorize-card',
          customerIdentifier: '08031234567',
          gateway: 'paystack',
          paymentKind: 'vtu',
          reference: 'VTU-CARD-AUTH-123',
          utilityType: 'data',
        }),
      });
    });
  });

  it('surfaces saved-card data purchases that are still processing', async () => {
    const onSuccessMock = jest.fn();
    mockUseUtilityPayment.mockReturnValue({
      cards: [],
      isLoadingCards: false,
      // Saved-card VTU charges are processed through Paystack even when no
      // manual gateway is selected.
      selectedGateway: null,
      selectedSavedCardId: 'saved-card-1',
      selectGateway: jest.fn(),
      selectSavedCard: jest.fn(),
      supportedGateways: ['paystack', 'korapay'],
    });
    mockChargeSavedVtuCard.mockResolvedValueOnce({
      reference: 'VTU-DATA-PENDING-123',
      status: 'processing',
    });
    mockIsSavedVtuCardChargeProcessing.mockReturnValueOnce(true);
    mockWaitForVtuConfirmation.mockRejectedValueOnce(
      new VtuPaymentStillProcessingError({
        amount: 1000,
        customerIdentifier: '08031234567',
        reference: 'VTU-DATA-PENDING-123',
      })
    );
    render(<DataForm onSuccess={onSuccessMock} />);

    fireEvent.press(screen.getByText('MTN 1GB Data'));
    fireEvent.changeText(screen.getByLabelText('Phone Number'), '08031234567');
    fireEvent.changeText(screen.getByLabelText('Amount'), '1000');
    fireEvent.press(screen.getByText('Pay ₦1,000'));

    await waitFor(() => {
      expect(mockChargeSavedVtuCard).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 1000,
          dataPlanCode: 'mtn-1gb',
          phoneNumber: '08031234567',
          savedPaymentMethodId: 'saved-card-1',
          type: 'data',
        })
      );
      expect(mockWaitForVtuConfirmation).toHaveBeenCalledWith({
        gateway: 'paystack',
        reference: 'VTU-DATA-PENDING-123',
      });
      expect(onSuccessMock).toHaveBeenCalledWith({
        amount: 1000,
        customerIdentifier: '08031234567',
        reference: 'VTU-DATA-PENDING-123',
        status: 'processing',
      });
    });
    expect(Alert.alert).not.toHaveBeenCalledWith(
      'Payment Failed',
      expect.any(String)
    );
  });
});
