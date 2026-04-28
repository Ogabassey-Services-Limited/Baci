import { jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { AirtimeForm } from './AirtimeForm';

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
  useUtilityPayment: () => ({
    cards: [],
    isLoadingCards: false,
    selectedGateway: 'paystack',
    selectedSavedCardId: null,
    selectGateway: jest.fn(),
    selectSavedCard: jest.fn(),
    supportedGateways: ['paystack', 'korapay'],
  }),
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: (selector: (state: { customer: null }) => unknown) =>
    selector({ customer: null }),
}));

jest.mock('@/lib/vtu-checkout', () => ({
  chargeSavedVtuCard: jest.fn(),
  initializeVtuCheckout: jest.fn(),
  isSavedVtuCardChargeProcessing: jest.fn(),
  requiresSavedVtuCardAuthorization: jest.fn(),
  waitForVtuConfirmation: jest.fn(),
}));

jest.mock('./UtilityPaymentOptions', () => {
  const { Text } =
    jest.requireActual<typeof import('react-native')>('react-native');

  return {
    UtilityPaymentOptions: () => <Text>Payment options</Text>,
  };
});

describe('AirtimeForm', () => {
  it('starts with the phone number and collapses the detected network', () => {
    render(<AirtimeForm onSuccess={jest.fn()} />);

    expect(screen.getByText('Phone Number')).toBeOnTheScreen();
    expect(screen.queryByText('Select Provider')).toBeNull();
    expect(screen.getByText('Choose manually')).toBeOnTheScreen();

    fireEvent.changeText(
      screen.getByPlaceholderText('08012345678'),
      '08031234567'
    );

    expect(screen.getByText('Network')).toBeOnTheScreen();
    expect(screen.getByText('MTN')).toBeOnTheScreen();
    expect(screen.getByLabelText('MTN logo')).toBeOnTheScreen();
    expect(screen.queryByText('Airtel')).toBeNull();

    fireEvent.press(screen.getByLabelText('Change selected network'));

    expect(screen.getByText('Airtel')).toBeOnTheScreen();
  });
});
