import { jest } from '@jest/globals';
import { Alert } from 'react-native';
import type { useUtilityPayment } from '@/hooks/use-utility-payment';
import { HttpError } from '@/lib/fetch-with-timeout';
import { createBillFormPurchaseHandler } from './create-bill-form-purchase-handler';

type PaymentState = ReturnType<typeof useUtilityPayment>;

const mockInitializeVtuCheckout = jest.fn<
  (...args: unknown[]) => Promise<{
    authorization_url: string;
    gateway: 'paystack';
    reference: string;
  }>
>();
const mockChargeWalletForVtu = jest.fn<(...args: unknown[]) => Promise<unknown>>();

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
}));

jest.mock('@/lib/vtu-checkout', () => {
  const actual = jest.requireActual<typeof import('@/lib/vtu-checkout')>(
    '@/lib/vtu-checkout'
  );
  return {
    ...actual,
    chargeSavedVtuCard: jest.fn(),
    chargeWalletForVtu: (...args: unknown[]) => mockChargeWalletForVtu(...args),
    initializeVtuCheckout: (...args: unknown[]) =>
      mockInitializeVtuCheckout(...args),
    isSavedVtuCardChargeProcessing: jest.fn(() => false),
    requiresSavedVtuCardAuthorization: jest.fn(() => false),
    waitForVtuConfirmation: jest.fn(),
  };
});

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

  describe('wallet flow', () => {
    it('clamps a stale walletSelection.amount that exceeds the current bill total', async () => {
      // The shopper enabled wallet for a ₦1500 plan, then changed to a
      // ₦1000 bill; selection.amount is now stale at 1500. Without the
      // clamp the request would carry walletAmount=1500 > amount=1000
      // and the server would 400.
      mockChargeWalletForVtu.mockResolvedValueOnce({
        status: 'successful',
        amount: 1000,
        reference: 'WAL-1',
      });
      const onSuccess = jest.fn();
      const resetWalletIdempotencyKey = jest.fn();
      const handlePurchase = createValidHandler({
        amount: '1000',
        numericAmount: 1000,
        onSuccess,
        payment: {
          cards: [],
          isLoadingCards: false,
          refetchCards: jest.fn<PaymentState['refetchCards']>(),
          selectGateway: jest.fn(),
          selectSavedCard: jest.fn(),
          selectedGateway: 'paystack',
          selectedSavedCardId: null,
          supportedGateways: ['paystack'],
          walletBalance: 1500,
          walletSelection: { use: true, amount: 1500 },
          setWalletSelection: jest.fn(),
          getWalletIdempotencyKey: jest.fn(() => 'idem-key-1'),
          resetWalletIdempotencyKey,
        },
      });

      await handlePurchase();

      expect(mockChargeWalletForVtu).toHaveBeenCalledTimes(1);
      const call = mockChargeWalletForVtu.mock.calls[0]?.[0] as {
        walletAmount: number;
        amount: number;
        idempotencyKey: string;
      };
      // Clamped: walletAmount === amount (the clamp also makes this a
      // wallet-only request, which is the right behavior — the
      // shopper had enough wallet to cover the new total).
      expect(call.walletAmount).toBe(1000);
      expect(call.amount).toBe(1000);
      // 200 OK ⇒ key rotates on the success path.
      expect(resetWalletIdempotencyKey).toHaveBeenCalledTimes(1);
    });

    it('keeps the idempotency key on a 5xx server error (server may have persisted state)', async () => {
      // Critical: rotating the key here would let the user's retry
      // bypass the route's dedupe table and create a duplicate
      // wallet debit. The same key MUST hit the existing
      // vtu_idempotency_keys row on retry.
      mockChargeWalletForVtu.mockRejectedValueOnce(
        new HttpError(500, 'Internal Server Error')
      );
      const resetWalletIdempotencyKey = jest.fn();
      const handlePurchase = createValidHandler({
        amount: '1000',
        numericAmount: 1000,
        payment: {
          cards: [],
          isLoadingCards: false,
          refetchCards: jest.fn<PaymentState['refetchCards']>(),
          selectGateway: jest.fn(),
          selectSavedCard: jest.fn(),
          selectedGateway: 'paystack',
          selectedSavedCardId: null,
          supportedGateways: ['paystack'],
          walletBalance: 1000,
          walletSelection: { use: true, amount: 1000 },
          setWalletSelection: jest.fn(),
          getWalletIdempotencyKey: jest.fn(() => 'idem-key-2'),
          resetWalletIdempotencyKey,
        },
      });

      await handlePurchase();

      expect(mockChargeWalletForVtu).toHaveBeenCalledTimes(1);
      expect(resetWalletIdempotencyKey).not.toHaveBeenCalled();
    });

    it('rotates the idempotency key on a 4xx response (request rejected before any state)', async () => {
      // 4xx means the server validated and rejected the request
      // before any side effects. A retry with the same key would
      // just keep failing — fresh key lets the user correct and
      // resubmit cleanly.
      mockChargeWalletForVtu.mockRejectedValueOnce(
        new HttpError(400, 'Bad Request')
      );
      const resetWalletIdempotencyKey = jest.fn();
      const handlePurchase = createValidHandler({
        amount: '1000',
        numericAmount: 1000,
        payment: {
          cards: [],
          isLoadingCards: false,
          refetchCards: jest.fn<PaymentState['refetchCards']>(),
          selectGateway: jest.fn(),
          selectSavedCard: jest.fn(),
          selectedGateway: 'paystack',
          selectedSavedCardId: null,
          supportedGateways: ['paystack'],
          walletBalance: 1000,
          walletSelection: { use: true, amount: 1000 },
          setWalletSelection: jest.fn(),
          getWalletIdempotencyKey: jest.fn(() => 'idem-key-3'),
          resetWalletIdempotencyKey,
        },
      });

      await handlePurchase();

      expect(mockChargeWalletForVtu).toHaveBeenCalledTimes(1);
      expect(resetWalletIdempotencyKey).toHaveBeenCalledTimes(1);
    });
  });
});
