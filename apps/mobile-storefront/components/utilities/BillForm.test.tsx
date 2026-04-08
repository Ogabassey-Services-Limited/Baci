import { fireEvent, render, screen } from '@testing-library/react-native';
import { BillForm } from './BillForm';

const mockVerifyMutate = jest.fn();
const mockVerifyReset = jest.fn();

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'light'),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/hooks/use-keyboard', () => ({
  useKeyboard: () => ({ isKeyboardVisible: false, keyboardHeight: 0 }),
}));

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
}));

jest.mock('@/hooks/use-utility-payment', () => ({
  useUtilityPayment: () => ({
    cards: [],
    isLoadingCards: false,
    refetchCards: jest.fn(),
    selectedGateway: 'paystack',
    selectedSavedCardId: null,
    selectGateway: jest.fn(),
    selectSavedCard: jest.fn(),
    supportedGateways: ['paystack', 'korapay'],
  }),
}));

jest.mock('@/lib/vtu-checkout', () => ({
  chargeSavedVtuCard: jest.fn(),
  initializeVtuCheckout: jest.fn(),
  waitForVtuConfirmation: jest.fn(),
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: (selector: (state: { customer: null }) => unknown) =>
    selector({ customer: null }),
}));

jest.mock('@/hooks/use-vtu-verify', () => ({
  useVTUVerify: () => ({
    mutate: (...args: unknown[]) => mockVerifyMutate(...args),
    reset: () => mockVerifyReset(),
    isPending: false,
    data: undefined,
    error: null,
  }),
}));

jest.mock('@/hooks/use-vtu-billers', () => ({
  useVTUBillers: () => ({
    data: [
      {
        billerId: 'ekedc',
        billerName: 'EKEDC NG',
        billerType: 'Electricity',
        categoryId: 'electricity',
        categoryName: 'Electricity',
        billItems: [
          {
            itemCode: 'prepaid',
            itemName: 'Prepaid',
            amount: 0,
            itemCurrencySymbol: 'NGN',
            isAmountFixed: false,
            itemFee: 0,
            billItems: [
              {
                itemCode: 'residential',
                itemName: 'Residential',
                amount: 0,
                itemCurrencySymbol: 'NGN',
                isAmountFixed: false,
                itemFee: 0,
              },
              {
                itemCode: 'commercial',
                itemName: 'Commercial',
                amount: 0,
                itemCurrencySymbol: 'NGN',
                isAmountFixed: false,
                itemFee: 0,
              },
            ],
          },
          {
            itemCode: 'postpaid',
            itemName: 'Postpaid',
            amount: 0,
            itemCurrencySymbol: 'NGN',
            isAmountFixed: false,
            itemFee: 0,
          },
        ],
      },
    ],
    isLoading: false,
    isError: false,
    error: null,
  }),
}));

describe('BillForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('waits for the full bill-item path before showing the identifier input', () => {
    render(<BillForm type="power" onSuccess={jest.fn()} />);

    fireEvent.press(screen.getByText('EKEDC NG'));
    expect(screen.queryByPlaceholderText('Enter meter number')).toBeNull();

    fireEvent.press(screen.getByText('Prepaid'));
    expect(screen.queryByPlaceholderText('Enter meter number')).toBeNull();

    fireEvent.press(screen.getByText('Residential'));
    expect(screen.getByPlaceholderText('Enter meter number')).toBeTruthy();
  });

  it('verifies against the selected leaf bill item', () => {
    render(<BillForm type="power" onSuccess={jest.fn()} />);

    fireEvent.press(screen.getByText('EKEDC NG'));
    fireEvent.press(screen.getByText('Prepaid'));
    fireEvent.press(screen.getByText('Commercial'));
    fireEvent.changeText(
      screen.getByPlaceholderText('Enter meter number'),
      '1234567890'
    );
    fireEvent.press(screen.getByText('Verify'));

    expect(mockVerifyMutate).toHaveBeenCalledWith({
      billItemIdentifier: 'commercial',
      customerIdentifier: '1234567890',
    });
  });
});
