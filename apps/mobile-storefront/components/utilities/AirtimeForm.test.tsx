import { jest } from '@jest/globals';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { Alert } from 'react-native';
import type { ExtractState } from 'zustand/vanilla';
import { VtuPaymentStillProcessingError } from '@/lib/vtu-checkout';
import type { useAuthStore as useAuthStoreType } from '@/stores/auth-store';
import { AirtimeForm } from './AirtimeForm';

type AuthStoreState = ExtractState<typeof useAuthStoreType>;
type AuthStorePartial = Partial<AuthStoreState>;

const mockUseUtilityPayment = jest.fn();
const mockChargeSavedVtuCard =
  jest.fn<
    (...args: unknown[]) => Promise<{
      amount?: number;
      cashback?: { amount: number; newBalance: number };
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

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
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

describe('AirtimeForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseUtilityPayment.mockReturnValue({
      cards: [],
      isLoadingCards: false,
      selectedGateway: 'paystack',
      selectedSavedCardId: null,
      selectGateway: jest.fn(),
      selectSavedCard: jest.fn(),
      supportedGateways: ['paystack', 'korapay'],
    });
    mockInitializeVtuCheckout.mockResolvedValue({
      authorization_url: 'https://checkout.paystack.com/test',
      gateway: 'paystack',
      reference: 'VTU-AIRTIME-123',
    });
    mockChargeSavedVtuCard.mockResolvedValue({
      amount: 1000,
      reference: 'VTU-CARD-123',
      voucherPin: 'token-123',
    });
    mockIsSavedVtuCardChargeProcessing.mockReturnValue(false);
    mockRequiresSavedVtuCardAuthorization.mockReturnValue(false);
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows manual network options before a provider is selected', () => {
    render(<AirtimeForm onSuccess={jest.fn()} />);

    expect(screen.getByText('Phone Number')).toBeOnTheScreen();
    expect(screen.getByText('Select Network')).toBeOnTheScreen();
    expect(screen.getByText('Choose manually')).toBeOnTheScreen();
    expect(screen.getByText('MTN')).toBeOnTheScreen();
    expect(screen.getByText('Airtel')).toBeOnTheScreen();
  });

  it('collapses to the detected network after phone entry', async () => {
    render(<AirtimeForm onSuccess={jest.fn()} />);

    fireEvent.changeText(
      screen.getByPlaceholderText('08012345678'),
      '08031234567'
    );

    await waitFor(() => expect(screen.getByText('MTN')).toBeOnTheScreen());
    expect(screen.getByText('Network')).toBeOnTheScreen();
    expect(screen.getByLabelText('MTN logo')).toBeOnTheScreen();
    expect(screen.queryByText('Airtel')).toBeNull();
  });

  it('expands network options from the selected network card', async () => {
    render(<AirtimeForm initialProvider="mtn" onSuccess={jest.fn()} />);

    expect(screen.getByText('Network')).toBeOnTheScreen();
    expect(screen.queryByText('Airtel')).toBeNull();

    fireEvent.press(screen.getByLabelText('Change selected network'));

    await waitFor(() => {
      expect(screen.getByText('Airtel')).toBeOnTheScreen();
    });
  });

  it('surfaces saved-card airtime purchases that are still processing', async () => {
    const onSuccessMock = jest.fn();
    mockUseUtilityPayment.mockReturnValue({
      cards: [],
      isLoadingCards: false,
      selectedGateway: null,
      selectedSavedCardId: 'saved-card-1',
      selectGateway: jest.fn(),
      selectSavedCard: jest.fn(),
      supportedGateways: ['paystack', 'korapay'],
    });
    mockChargeSavedVtuCard.mockResolvedValueOnce({
      reference: 'VTU-CARD-PENDING-123',
      status: 'processing',
    });
    mockIsSavedVtuCardChargeProcessing.mockReturnValueOnce(true);
    mockWaitForVtuConfirmation.mockRejectedValueOnce(
      new VtuPaymentStillProcessingError({
        amount: 1000,
        customerIdentifier: '08031234567',
        reference: 'VTU-CARD-PENDING-123',
      })
    );
    render(<AirtimeForm onSuccess={onSuccessMock} />);

    fireEvent.changeText(
      screen.getByPlaceholderText('08012345678'),
      '08031234567'
    );
    await waitFor(() => expect(screen.getByText('Network')).toBeOnTheScreen());
    fireEvent.changeText(screen.getByPlaceholderText('1,000'), '1000');
    fireEvent.press(screen.getByText('Pay ₦1,000'));

    await waitFor(() => {
      expect(mockChargeSavedVtuCard).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 1000,
          phoneNumber: '08031234567',
          savedPaymentMethodId: 'saved-card-1',
          type: 'airtime',
        })
      );
    });
    expect(mockWaitForVtuConfirmation).toHaveBeenCalledWith({
      gateway: 'paystack',
      reference: 'VTU-CARD-PENDING-123',
    });
    await waitFor(() => {
      expect(onSuccessMock).toHaveBeenCalledWith({
        amount: 1000,
        customerIdentifier: '08031234567',
        reference: 'VTU-CARD-PENDING-123',
        status: 'processing',
      });
    });
    expect(Alert.alert).not.toHaveBeenCalledWith(
      'Payment Failed',
      expect.any(String)
    );
  });
});
