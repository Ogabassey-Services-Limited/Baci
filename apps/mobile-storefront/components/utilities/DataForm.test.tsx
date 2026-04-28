import { jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { DataForm } from './DataForm';

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

jest.mock('@/hooks/use-vtu-billers', () => ({
  useVTUBillers: () => ({
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
    isLoading: false,
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

describe('DataForm', () => {
  it('uses the biller picker pattern and collapses the selected data bundle', () => {
    render(<DataForm onSuccess={jest.fn()} />);

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
});
