import { jest } from '@jest/globals';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { Alert } from 'react-native';
import type { ExtractState } from 'zustand/vanilla';
import { BRAND } from '@/constants/Colors';
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
const mockRouterPush = jest.fn();
const mockIsSavedVtuCardChargeProcessing = jest.fn();
const mockRequiresSavedVtuCardAuthorization = jest.fn();
// Exposed by the mocked keyboard hook so future interaction tests can assert dismissal.
const mockDismissKeyboard = jest.fn();
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

function spyOnConsoleError() {
  return jest.spyOn(console, 'error').mockImplementation(() => undefined);
}

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
    dismissKeyboard: mockDismissKeyboard,
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

  it('keeps network provider cards hidden until manual selection', () => {
    render(<AirtimeForm onSuccess={jest.fn()} />);

    expect(screen.getByText('Phone Number')).toBeOnTheScreen();
    expect(screen.getByText('Select Network')).toBeOnTheScreen();
    expect(screen.getByText('Choose manually')).toBeOnTheScreen();
    expect(screen.queryByText('MTN')).toBeNull();
    expect(screen.queryByText('Airtel')).toBeNull();

    fireEvent.press(screen.getByLabelText('Choose network manually'));

    expect(screen.getByText('MTN')).toBeOnTheScreen();
    expect(screen.getByText('Airtel')).toBeOnTheScreen();
  });

  it('does not auto-expand network options for unknown phone prefixes', () => {
    render(<AirtimeForm onSuccess={jest.fn()} />);

    fireEvent.changeText(
      screen.getByPlaceholderText('08012345678'),
      '08012345678'
    );

    expect(screen.getByText('Choose manually')).toBeOnTheScreen();
    expect(screen.queryByText('MTN')).toBeNull();
    expect(screen.queryByText('Airtel')).toBeNull();
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

  it('clears the detected network when the phone number is erased', async () => {
    render(<AirtimeForm onSuccess={jest.fn()} />);

    fireEvent.changeText(
      screen.getByPlaceholderText('08012345678'),
      '08031234567'
    );
    await waitFor(() => expect(screen.getByText('Network')).toBeOnTheScreen());

    fireEvent.changeText(screen.getByPlaceholderText('08012345678'), '');

    expect(screen.queryByText('Network')).toBeNull();
    expect(screen.queryByText('MTN')).toBeNull();
    expect(screen.getByText('Choose manually')).toBeOnTheScreen();
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

  it('highlights a quick amount when tapped', () => {
    render(<AirtimeForm onSuccess={jest.fn()} />);

    fireEvent.press(screen.getByText('₦1,000'));

    expect(screen.getByText('₦1,000')).toHaveStyle({
      color: BRAND.onPrimary,
    });
  });

  it('highlights the matching quick amount when typed manually', () => {
    render(<AirtimeForm onSuccess={jest.fn()} />);

    fireEvent.changeText(screen.getByPlaceholderText('1,000'), '1000');

    expect(screen.getByText('₦1,000')).toHaveStyle({
      color: BRAND.onPrimary,
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
    await waitFor(() => {
      expect(mockWaitForVtuConfirmation).toHaveBeenCalledWith({
        gateway: 'paystack',
        reference: 'VTU-CARD-PENDING-123',
      });
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

  it('keeps the submitting state while navigating to checkout', async () => {
    render(<AirtimeForm onSuccess={jest.fn()} />);

    fireEvent.changeText(
      screen.getByPlaceholderText('08012345678'),
      '08031234567'
    );
    await waitFor(() => expect(screen.getByText('Network')).toBeOnTheScreen());
    fireEvent.changeText(screen.getByPlaceholderText('1,000'), '1000');
    fireEvent.press(screen.getByText('Continue to Payment'));

    await waitFor(() => {
      expect(mockInitializeVtuCheckout).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 1000,
          phoneNumber: '08031234567',
          type: 'airtime',
        })
      );
    });
    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: '/payment-gateway',
      params: expect.objectContaining({
        amount: '1000',
        customerIdentifier: '08031234567',
        paymentKind: 'vtu',
        reference: 'VTU-AIRTIME-123',
        utilityType: 'airtime',
      }),
    });
    expect(screen.queryByText('Continue to Payment')).toBeNull();
  });

  it('resets submitting state when checkout navigation throws', async () => {
    const consoleErrorSpy = spyOnConsoleError();
    mockRouterPush.mockImplementationOnce(() => {
      throw new Error('Navigation failed');
    });
    render(<AirtimeForm onSuccess={jest.fn()} />);

    fireEvent.changeText(
      screen.getByPlaceholderText('08012345678'),
      '08031234567'
    );
    await waitFor(() => expect(screen.getByText('Network')).toBeOnTheScreen());
    fireEvent.changeText(screen.getByPlaceholderText('1,000'), '1000');
    fireEvent.press(screen.getByText('Continue to Payment'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Payment Failed',
        'Navigation failed'
      );
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Airtime purchase failed:',
      expect.any(Error)
    );
    await waitFor(() => {
      expect(screen.getByText('Continue to Payment')).toBeOnTheScreen();
    });
  });

  it('alerts and does not complete when a saved-card airtime charge rejects', async () => {
    const consoleErrorSpy = spyOnConsoleError();
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
    mockChargeSavedVtuCard.mockRejectedValueOnce(
      new Error('Saved card charge failed')
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
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Payment Failed',
        'Saved card charge failed'
      );
    });
    expect(mockWaitForVtuConfirmation).not.toHaveBeenCalled();
    expect(onSuccessMock).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Airtime purchase failed:',
      expect.any(Error)
    );
  });
});
