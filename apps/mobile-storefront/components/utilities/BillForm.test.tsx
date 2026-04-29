import { jest } from '@jest/globals';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import type { Biller, BillItem } from '@/hooks/use-vtu-billers';
import { VtuPaymentStillProcessingError } from '@/lib/vtu-checkout';
import { BillForm } from './BillForm';

const mockVerifyMutate = jest.fn();
const mockVerifyReset = jest.fn();
const mockUseUtilityPayment = jest.fn();
const mockChargeSavedVtuCard =
  jest.fn<
    (...args: unknown[]) => Promise<{
      amount?: number;
      authorization_url?: string;
      cashback?: { amount: number; newBalance: number };
      gateway?: 'paystack';
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
const mockIsSavedVtuCardChargeProcessing =
  jest.fn<(...args: unknown[]) => boolean>();
const mockRequiresSavedVtuCardAuthorization =
  jest.fn<(...args: unknown[]) => boolean>();
const mockWaitForVtuConfirmation =
  jest.fn<
    (...args: unknown[]) => Promise<{
      amount?: number;
      cashback?: { amount: number; newBalance: number };
      reference: string;
      voucherPin?: string;
    }>
  >();

function mockBillItem(overrides: Partial<BillItem>): BillItem {
  return {
    amount: 0,
    isAmountFixed: false,
    itemCode: 'item',
    itemCurrencySymbol: 'NGN',
    itemFee: 0,
    itemName: 'Item',
    ...overrides,
  };
}

function mockBiller(overrides: Partial<Biller>): Biller {
  return {
    billerId: 'biller',
    billerName: 'Biller',
    billerType: 'Utility',
    categoryId: 'utility',
    categoryName: 'Utility',
    billItems: [],
    ...overrides,
  };
}

function mockPowerBillers(): Biller[] {
  return [
    mockBiller({
      billerId: 'ekedc',
      billerName: 'EKEDC NG',
      billerType: 'Electricity',
      categoryId: 'electricity',
      categoryName: 'Electricity',
      billItems: [
        mockBillItem({
          itemCode: 'prepaid',
          itemName: 'Prepaid',
          billItems: [
            mockBillItem({
              itemCode: 'residential',
              itemName: 'Residential',
            }),
            mockBillItem({
              itemCode: 'commercial',
              itemName: 'Commercial',
            }),
          ],
        }),
        mockBillItem({
          itemCode: 'postpaid',
          itemName: 'Postpaid',
        }),
      ],
    }),
  ];
}

let mockBillers = mockPowerBillers();

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'light'),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/hooks/use-keyboard', () => ({
  useKeyboard: () => ({
    dismissKeyboard: jest.fn(),
    isKeyboardVisible: false,
    keyboardHeight: 0,
  }),
}));

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
}));

jest.mock('@/hooks/use-utility-payment', () => ({
  useUtilityPayment: () => mockUseUtilityPayment(),
}));

jest.mock('./UtilityPaymentOptions', () => {
  const { Text } =
    jest.requireActual<typeof import('react-native')>('react-native');

  return {
    UtilityPaymentOptions: () => <Text>Payment options</Text>,
  };
});

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
    data: mockBillers,
    isLoading: false,
    isError: false,
    error: null,
  }),
}));

describe('BillForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBillers = mockPowerBillers();
    mockUseUtilityPayment.mockReturnValue({
      cards: [],
      isLoadingCards: false,
      refetchCards: jest.fn(),
      selectedGateway: 'paystack',
      selectedSavedCardId: null,
      selectGateway: jest.fn(),
      selectSavedCard: jest.fn(),
      supportedGateways: ['paystack', 'korapay'],
    });
    mockChargeSavedVtuCard.mockResolvedValue({
      amount: 1000,
      reference: 'VTU-BILL-123',
    });
    mockInitializeVtuCheckout.mockResolvedValue({
      authorization_url: 'https://checkout.paystack.com/test',
      gateway: 'paystack',
      reference: 'VTU-BILL-123',
    });
    mockIsSavedVtuCardChargeProcessing.mockReturnValue(false);
    mockRequiresSavedVtuCardAuthorization.mockReturnValue(false);
    mockWaitForVtuConfirmation.mockResolvedValue({
      amount: 1000,
      reference: 'VTU-BILL-123',
    });
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

  it('starts a verified repeat at the payment section for previous bill details', () => {
    render(
      <BillForm
        type="power"
        initialAmount="2500"
        initialBillerName="EKEDC NG"
        initialBillItemIdentifier="commercial"
        initialCustomerIdentifier="1234567890"
        isRepeatPaymentReady
        onSuccess={jest.fn()}
      />
    );

    expect(screen.getByText('Amount (₦)')).toBeOnTheScreen();
    expect(screen.getByText('Payment options')).toBeOnTheScreen();
    expect(mockVerifyMutate).not.toHaveBeenCalled();
  });

  it('infers a repeat bill item from saved biller name when item code is missing', () => {
    render(
      <BillForm
        type="power"
        initialAmount="2500"
        initialBillerName="EKEDC NG - Postpaid"
        initialCustomerIdentifier="1234567890"
        isRepeatPaymentReady
        onSuccess={jest.fn()}
      />
    );

    expect(screen.getByText('Amount (₦)')).toBeOnTheScreen();
    expect(screen.getByText('Payment options')).toBeOnTheScreen();
    expect(mockVerifyMutate).not.toHaveBeenCalled();
  });

  it('matches a saved biller name by exact or token-boundary text before shorter substrings', () => {
    mockBillers = [
      mockBiller({
        billerId: 'generic-tv',
        billerName: 'TV',
        billItems: [],
      }),
      mockBiller({
        billerId: 'dstv',
        billerName: 'DSTV',
        billItems: [
          mockBillItem({
            amount: 0,
            itemCode: 'compact',
            itemName: 'Compact',
          }),
        ],
      }),
    ];

    render(
      <BillForm
        type="tv"
        initialAmount="2500"
        initialBillerName="DSTV Compact"
        initialCustomerIdentifier="1234567890"
        isRepeatPaymentReady
        onSuccess={jest.fn()}
      />
    );

    expect(screen.getByText('DSTV')).toBeOnTheScreen();
    expect(screen.getByText('Compact')).toBeOnTheScreen();
    expect(screen.getByText('Amount (₦)')).toBeOnTheScreen();
  });

  it('prefers a fixed leaf amount over the saved repeat amount', () => {
    mockBillers = [
      mockBiller({
        billerId: 'dstv',
        billerName: 'DSTV',
        billItems: [
          mockBillItem({
            amount: 7000,
            isAmountFixed: true,
            itemCode: 'compact',
            itemName: 'Compact',
          }),
        ],
      }),
    ];

    render(
      <BillForm
        type="tv"
        initialAmount="2500"
        initialBillerName="DSTV"
        initialBillItemIdentifier="compact"
        initialCustomerIdentifier="1234567890"
        isRepeatPaymentReady
        onSuccess={jest.fn()}
      />
    );

    expect(screen.getByDisplayValue('7,000')).toBeOnTheScreen();
  });

  it('surfaces saved-card bill payments that are still processing', async () => {
    const onSuccess = jest.fn();
    mockUseUtilityPayment.mockReturnValue({
      cards: [],
      isLoadingCards: false,
      refetchCards: jest.fn(),
      selectedGateway: null,
      selectedSavedCardId: 'saved-card-1',
      selectGateway: jest.fn(),
      selectSavedCard: jest.fn(),
      supportedGateways: ['paystack', 'korapay'],
    });
    mockChargeSavedVtuCard.mockResolvedValueOnce({
      reference: 'VTU-BILL-PENDING-123',
      status: 'processing',
    });
    mockIsSavedVtuCardChargeProcessing.mockReturnValueOnce(true);
    mockWaitForVtuConfirmation.mockRejectedValueOnce(
      new VtuPaymentStillProcessingError({
        amount: 2500,
        customerIdentifier: '1234567890',
        reference: 'VTU-BILL-PENDING-123',
      })
    );

    render(
      <BillForm
        type="power"
        initialAmount="2500"
        initialBillerName="EKEDC NG"
        initialBillItemIdentifier="postpaid"
        initialCustomerIdentifier="1234567890"
        isRepeatPaymentReady
        onSuccess={onSuccess}
      />
    );

    fireEvent.press(screen.getByText('Pay ₦2,500'));

    await waitFor(() => {
      expect(mockChargeSavedVtuCard).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 2500,
          customerIdentifier: '1234567890',
          savedPaymentMethodId: 'saved-card-1',
          type: 'electricity',
        })
      );
    });
    await waitFor(() => {
      expect(mockWaitForVtuConfirmation).toHaveBeenCalledWith({
        gateway: 'paystack',
        reference: 'VTU-BILL-PENDING-123',
      });
    });
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith({
        amount: 2500,
        customerIdentifier: '1234567890',
        reference: 'VTU-BILL-PENDING-123',
        status: 'processing',
      });
    });
  });
});
