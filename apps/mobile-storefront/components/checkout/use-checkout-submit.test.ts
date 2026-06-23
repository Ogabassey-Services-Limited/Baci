import { act, renderHook } from '@testing-library/react-native';
import type { MutableRefObject } from 'react';
import { Alert } from 'react-native';
import type { CartPriceChange, RepriceResult } from '@/services/cart-reprice';
import type { CartItem } from '@/stores/cart-store.types';
import { CHECKOUT_MERCHANT_ID } from './checkout-screen.constants';
import {
  type UseCheckoutSubmitParams,
  useCheckoutSubmit,
} from './use-checkout-submit';

const mockRepriceCartItems = jest.fn() as jest.MockedFunction<
  (items: CartItem[], merchantId: string) => Promise<RepriceResult>
>;
const mockCreateOrder = jest.fn();
const mockValidateCheckoutSubmission = jest.fn();
const mockRepriceItems = jest.fn();
const mockRestoreItems = jest.fn();
let cartItems: CartItem[] = [];

jest.mock('@/services/cart-reprice', () => ({
  repriceCartItems: (items: CartItem[], merchantId: string) =>
    mockRepriceCartItems(items, merchantId),
}));

jest.mock('@/services/orders', () => ({
  createOrder: mockCreateOrder,
}));

jest.mock('@/services/analytics', () => ({
  trackCheckoutStep: jest.fn(),
}));

jest.mock('@/services/tiktok-checkout-route-tracking', () => ({
  trackCheckoutRoutePurchaseCompleted: jest.fn(),
}));

jest.mock('@/stores/cart-store', () => ({
  useCartStore: jest.fn(),
}));

jest.mock('./checkout-bnpl-submit', () => ({
  submitBnplCheckout: jest.fn(),
}));

jest.mock('./checkout-order-builders', () => ({
  buildCheckoutOrderRequest: jest.fn(),
  createCheckoutSnapshot: jest.fn(() => ({
    deliveryFee: 1500,
    subtotal: 1200000,
    taxAmount: 0,
    total: 1201500,
  })),
}));

jest.mock('./checkout-payment-finalization', () => ({
  finalizeCheckoutPayment: jest.fn(),
}));

jest.mock('./checkout-post-order-side-effects', () => ({
  runCheckoutPostOrderSideEffects: jest.fn(),
}));

jest.mock('./checkout-store-credit', () => ({
  resolveCheckoutStoreCreditSelections: jest.fn(() => ({
    liveSavingsSelection: undefined,
    liveWalletSelection: undefined,
  })),
}));

jest.mock('./checkout-submit-error', () => ({
  handleCheckoutSubmitError: jest.fn(),
}));

jest.mock('./checkout-submit-validation', () => ({
  validateCheckoutSubmission: (
    input: Parameters<
      typeof import('./checkout-submit-validation').validateCheckoutSubmission
    >[0]
  ) => mockValidateCheckoutSubmission(input),
}));

const mockedUseCartStore = (
  jest.requireMock('@/stores/cart-store') as {
    useCartStore: jest.Mock & {
      getState?: () => {
        items: CartItem[];
        repriceItems: typeof mockRepriceItems;
        restoreItems: typeof mockRestoreItems;
      };
    };
  }
).useCartStore;

const cartItem: CartItem = {
  id: 'line-1',
  name: 'iPhone 15 Pro',
  price: 1200000,
  product_id: 'product-1',
  quantity: 1,
  slug: 'iphone-15-pro',
};

const address = {
  address: '1 Test Way',
  city: 'Ikeja',
  email: 'customer@example.com',
  firstName: 'Ada',
  lastName: 'Okafor',
  phone: '08012345678',
  state: 'Lagos',
};

function createRef<T>(current: T): MutableRefObject<T> {
  return { current };
}

function createParams(
  overrides: Partial<UseCheckoutSubmitParams> = {}
): UseCheckoutSubmitParams {
  return {
    accountPassword: '',
    appliedDiscountCode: null,
    availablePaymentMethods: ['paystack'],
    clearCart: jest.fn(),
    currentShippingQuoteContextKey: 'door:Lagos:Ikeja',
    customer: null,
    deliveryFee: 1500,
    deliveryMethod: 'door',
    getLiveSavingsSelection: jest.fn(),
    getShippingProvider: () => 'gigl',
    isAuthenticated: false,
    isLoadingQuotes: false,
    isOrderInFlight: createRef(false),
    isProcessing: false,
    mobileCheckoutIdempotencyRef: createRef(null),
    orderTotals: { taxAmount: 0 },
    paymentSettings: { klump_enabled: true },
    paymentTab: 'full',
    resolvedShippingQuoteContextKey: 'door:Lagos:Ikeja',
    saveAsDefaultAddress: false,
    saveDetails: false,
    selectedPayment: 'paystack',
    selectedQuote: undefined,
    selectedSavedAddressId: null,
    setIsProcessing: jest.fn(),
    setPendingOrder: jest.fn(),
    setShowCryptoSelection: jest.fn(),
    setStep: jest.fn(),
    user: null,
    walletBalance: 0,
    walletFundedBankTransferOptionEnabled: false,
    walletSelection: undefined,
    ...overrides,
  };
}

describe('useCheckoutSubmit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cartItems = [cartItem];
    mockedUseCartStore.getState = () => ({
      items: cartItems,
      repriceItems: mockRepriceItems,
      restoreItems: mockRestoreItems,
    });
    // validateCheckoutSubmission returns true when the submission is valid
    // (proceed). Default to valid so the freeze step, which now runs after
    // validation, is reached.
    mockValidateCheckoutSubmission.mockReturnValue(true);
    mockCreateOrder.mockResolvedValue({
      order: {
        id: 'order-1',
        order_number: 'ORD-1',
        total: 1201500,
      },
    });
    jest.spyOn(Alert, 'alert').mockImplementation(() => {
      // Suppress native alerts in tests.
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('updates stale cart prices and aborts checkout after validation passes', async () => {
    const changes: CartPriceChange[] = [
      {
        id: 'line-1',
        name: 'iPhone 15 Pro',
        oldPrice: 1200000,
        newPrice: 1250000,
      },
    ];
    mockRepriceCartItems.mockResolvedValue({
      changes,
      priceById: { 'line-1': 1250000 },
    });
    const setIsProcessing = jest.fn();
    const params = createParams({ setIsProcessing });

    const { result } = renderHook(() => useCheckoutSubmit(params));

    await act(async () => {
      await result.current(address);
    });

    expect(mockRepriceCartItems).toHaveBeenCalledWith(
      [cartItem],
      CHECKOUT_MERCHANT_ID
    );
    expect(mockRepriceItems).toHaveBeenCalledWith({ 'line-1': 1250000 });
    expect(Alert.alert).toHaveBeenCalledWith(
      'Prices updated',
      expect.stringContaining('please review the new total'),
      [{ text: 'OK' }]
    );
    // Validation runs before the freeze step, then the processing lock is
    // engaged before repricing. A drift abort releases that lock in finally.
    expect(mockValidateCheckoutSubmission).toHaveBeenCalled();
    expect(mockCreateOrder).not.toHaveBeenCalled();
    expect(setIsProcessing).toHaveBeenNthCalledWith(1, true);
    expect(setIsProcessing).toHaveBeenLastCalledWith(false);
    expect(params.isOrderInFlight.current).toBe(false);
  });

  it('engages the in-flight lock before async repricing to block double taps', async () => {
    let resolveReprice: (value: RepriceResult) => void = () => undefined;
    const validationInFlightStates: boolean[] = [];
    mockRepriceCartItems.mockImplementation(
      () =>
        new Promise<RepriceResult>((resolve) => {
          resolveReprice = resolve;
        })
    );
    mockValidateCheckoutSubmission.mockImplementation(
      (input: { isOrderInFlight: MutableRefObject<boolean> }) => {
        validationInFlightStates.push(input.isOrderInFlight.current);
        return !input.isOrderInFlight.current;
      }
    );
    const params = createParams();

    const { result } = renderHook(() => useCheckoutSubmit(params));

    let firstSubmit: Promise<void> | undefined;
    await act(async () => {
      firstSubmit = result.current(address);
      await Promise.resolve();
    });

    expect(params.isOrderInFlight.current).toBe(true);

    await act(async () => {
      await result.current(address);
    });

    expect(mockValidateCheckoutSubmission).toHaveBeenCalledTimes(2);
    expect(validationInFlightStates).toEqual([false, true]);
    expect(mockRepriceCartItems).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveReprice({
        changes: [],
        priceById: { 'line-1': 1200000 },
      });
      await firstSubmit;
    });

    expect(params.isOrderInFlight.current).toBe(false);
  });

  it('proceeds past the freeze step into order creation when prices are unchanged', async () => {
    mockRepriceCartItems.mockResolvedValue({
      changes: [],
      priceById: { 'line-1': 1200000 },
    });
    const setIsProcessing = jest.fn();
    const params = createParams({ setIsProcessing });

    const { result } = renderHook(() => useCheckoutSubmit(params));

    await act(async () => {
      await result.current(address);
    });

    expect(mockValidateCheckoutSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        itemsLength: 1,
        selectedPayment: 'paystack',
      })
    );
    expect(mockRepriceCartItems).toHaveBeenCalledWith(
      [cartItem],
      CHECKOUT_MERCHANT_ID
    );
    // No drift → cart is not mutated and no alert; the submit advances into
    // the order path (processing state set, order marked in-flight).
    expect(mockRepriceItems).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
    // setIsProcessing(true) is the reliable marker that the submit advanced
    // past the freeze into the order path (isOrderInFlight is reset by the
    // downstream finally handler once the mocked order path settles).
    expect(setIsProcessing).toHaveBeenCalledWith(true);
  });

  it('skips repricing entirely when validation fails', async () => {
    mockValidateCheckoutSubmission.mockReturnValue(false);
    const setIsProcessing = jest.fn();
    const params = createParams({ setIsProcessing });

    const { result } = renderHook(() => useCheckoutSubmit(params));

    await act(async () => {
      await result.current(address);
    });

    // Freeze runs after validation, so an invalid (e.g. in-flight) submit is
    // rejected before any reprice round-trip, cart mutation, or order.
    expect(mockValidateCheckoutSubmission).toHaveBeenCalled();
    expect(mockRepriceCartItems).not.toHaveBeenCalled();
    expect(mockRepriceItems).not.toHaveBeenCalled();
    expect(mockCreateOrder).not.toHaveBeenCalled();
    expect(setIsProcessing).not.toHaveBeenCalled();
    expect(params.isOrderInFlight.current).toBe(false);
  });
});
