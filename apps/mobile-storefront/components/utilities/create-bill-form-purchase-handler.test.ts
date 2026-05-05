import { jest } from '@jest/globals';
import { Alert } from 'react-native';
import type { useUtilityPayment } from '@/hooks/use-utility-payment';
import { createBillFormPurchaseHandler } from './create-bill-form-purchase-handler';

type PaymentState = ReturnType<typeof useUtilityPayment>;

const mockInitializeVtuCheckout = jest.fn<
  (...args: unknown[]) => Promise<{
    authorization_url: string;
    gateway: 'paystack';
    reference: string;
  }>
>();

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
}));

jest.mock('@/lib/vtu-checkout', () => ({
  chargeSavedVtuCard: jest.fn(),
  initializeVtuCheckout: (...args: unknown[]) =>
    mockInitializeVtuCheckout(...args),
  isSavedVtuCardChargeProcessing: jest.fn(() => false),
  requiresSavedVtuCardAuthorization: jest.fn(() => false),
  waitForVtuConfirmation: jest.fn(),
  VtuPaymentStillProcessingError: class VtuPaymentStillProcessingError extends Error {},
}));

function createValidHandler(overrides = {}) {
  return createBillFormPurchaseHandler({
    amount: '1000',
    billType: 'electricity',
    canShowPayment: true,
    customer: null,
    customerId: '1234567890',
    dismissKeyboard: jest.fn(),
    getIsSubmitting: () => false,
    numericAmount: 1000,
    onSuccess: jest.fn(),
    payment: {
      cards: [],
      isLoadingCards: false,
      refetchCards: jest.fn<PaymentState['refetchCards']>(),
      selectGateway: jest.fn(),
      selectSavedCard: jest.fn(),
      selectedGateway: 'paystack',
      selectedSavedCardId: null,
      supportedGateways: ['paystack'],
      walletBalance: 0,
      walletSelection: undefined,
      setWalletSelection: jest.fn(),
      getWalletIdempotencyKey: jest.fn(() => 'test-key'),
      resetWalletIdempotencyKey: jest.fn(),
    },
    selectedBiller: {
      billerId: 'ekedc',
      billerName: 'EKEDC NG',
      billerType: 'Electricity',
      categoryId: 'electricity',
      categoryName: 'Electricity',
    },
    selectedBillItemIdentifier: 'postpaid',
    selectedBillItemPathLabel: 'Postpaid',
    setIsSubmitting: jest.fn(),
    type: 'power',
    verifiedCustomerName: null,
    ...overrides,
  });
}

describe('createBillFormPurchaseHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses a generic checkout error message for unsafe exceptions', async () => {
    mockInitializeVtuCheckout.mockRejectedValueOnce(
      new Error('Gateway failed\nToken: secret')
    );
    const handlePurchase = createValidHandler();

    await handlePurchase();

    expect(Alert.alert).toHaveBeenCalledWith(
      'Payment Failed',
      'Payment failed. Please try again.'
    );
  });

  it('sends the verified meter-owner name as customerName, overriding the buyer name', async () => {
    mockInitializeVtuCheckout.mockResolvedValueOnce({
      authorization_url: 'https://gateway/auth',
      gateway: 'paystack',
      reference: 'PAY-123',
    });
    const handlePurchase = createValidHandler({
      customer: {
        first_name: 'Bassey',
        last_name: 'John',
        email: 'bassey@example.com',
      },
      verifiedCustomerName: 'JANE METER-OWNER',
    });

    await handlePurchase();

    expect(mockInitializeVtuCheckout).toHaveBeenCalledTimes(1);
    expect(mockInitializeVtuCheckout.mock.calls[0][0]).toMatchObject({
      customerName: 'JANE METER-OWNER',
    });
  });

  it('falls back to the buyer name when no verified meter-owner name is provided', async () => {
    mockInitializeVtuCheckout.mockResolvedValueOnce({
      authorization_url: 'https://gateway/auth',
      gateway: 'paystack',
      reference: 'PAY-456',
    });
    const handlePurchase = createValidHandler({
      customer: {
        first_name: 'Bassey',
        last_name: 'John',
        email: 'bassey@example.com',
      },
      verifiedCustomerName: null,
    });

    await handlePurchase();

    expect(mockInitializeVtuCheckout.mock.calls[0][0]).toMatchObject({
      customerName: 'Bassey John',
    });
  });
});
