import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import type { Product } from '@/types/product';
import { useStartSavingsController } from './use-start-savings-controller';

const mockUseLocalSearchParams = jest.fn();
const mockUseProducts = jest.fn();
const mockRefetch = jest.fn();
const mockSubmitSavingsGoal = jest.fn<() => Promise<void>>();
const mockSetPaymentMethodsError = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));

jest.mock('@/hooks/use-debounce', () => ({
  useDebounce: (value: string) => value,
}));

jest.mock('@/hooks/use-products', () => ({
  useProducts: (...args: unknown[]) => mockUseProducts(...args),
}));

jest.mock('@/hooks/use-wallet', () => ({
  useWallet: () => ({
    data: {
      wallet: {
        balance: 200000,
        earnings_balance: 200000,
        funding_account: {
          account_number: '0123456789',
          bank_name: 'Titan Paystack',
          provider: 'paystack',
        },
      },
    },
    isRefetching: false,
    refetch: mockRefetch,
  }),
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: (selector: (state: { merchantId: string | null }) => unknown) =>
    selector({ merchantId: 'merchant-1' }),
}));

jest.mock('./use-start-savings-payment-methods', () => ({
  useStartSavingsPaymentMethods: () => ({
    isLoadingPaymentMethods: false,
    paymentMethodsError: null,
    savedPaymentMethods: [],
    selectedPaymentMethodId: null,
    setPaymentMethodsError: mockSetPaymentMethodsError,
    setSelectedPaymentMethodId: jest.fn(),
  }),
}));

jest.mock('./use-start-savings-submit', () => ({
  useStartSavingsSubmit: () => ({
    goToWallet: jest.fn(),
    handleAuthorizeSavingsCard: jest.fn(),
    handleCopyFundingAccount: jest.fn(),
    isAuthorizingCard: false,
    isSubmitting: false,
    openWalletFundingScreen: jest.fn(),
    submitSavingsGoal: mockSubmitSavingsGoal,
  }),
}));

const product: Product = {
  id: 'product-1',
  image: 'https://example.com/iphone.jpg',
  name: 'iPhone 13 Pro Max',
  price: 800000,
  slug: 'iphone-13-pro-max',
};

describe('useStartSavingsController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseLocalSearchParams.mockReturnValue({});
    mockUseProducts.mockReturnValue({
      isLoading: false,
      products: [product],
    });
    mockSubmitSavingsGoal.mockResolvedValue(undefined);
  });

  it('validates required fields before opening the preview', () => {
    const { result } = renderHook(() => useStartSavingsController());

    act(() => {
      result.current.handleContinue();
    });

    expect(result.current.formError).toBe(
      'Select the product you want to save for.'
    );
    expect(result.current.showPreviewModal).toBe(false);
  });

  it('opens preview for a complete manual savings form', () => {
    const { result } = renderHook(() => useStartSavingsController());

    act(() => {
      result.current.selectProduct(product);
      result.current.setContributionAmount('20000');
      result.current.setAcceptsNonWithdrawableTerms(true);
    });
    act(() => {
      result.current.handleContinue();
    });

    expect(result.current.formError).toBeNull();
    expect(result.current.showPreviewModal).toBe(true);
    expect(result.current.targetValue).toBe(800000);
  });

  it('clears form errors after correcting product and amount fields', () => {
    const { result } = renderHook(() => useStartSavingsController());

    act(() => {
      result.current.handleContinue();
    });
    expect(result.current.formError).toBe(
      'Select the product you want to save for.'
    );

    act(() => {
      result.current.selectProduct(product);
      result.current.setTargetAmount('not-a-number');
      result.current.setContributionAmount('₦20,000');
      result.current.setAcceptsNonWithdrawableTerms(true);
    });
    expect(result.current.formError).toBeNull();

    act(() => {
      result.current.handleContinue();
    });
    expect(result.current.formError).toBe('Enter a valid target amount.');

    act(() => {
      result.current.setTargetAmount('₦800,000');
    });
    expect(result.current.formError).toBeNull();
  });

  it('selects a searched product and copies its price into the target amount', () => {
    const { result } = renderHook(() => useStartSavingsController());

    act(() => {
      result.current.setSearchValue('iphone');
      result.current.selectProduct(product);
    });

    expect(result.current.searchValue).toBe('iPhone 13 Pro Max');
    expect(result.current.selectedProduct).toEqual(
      expect.objectContaining({
        id: 'product-1',
        name: 'iPhone 13 Pro Max',
      })
    );
    expect(result.current.targetAmount).toBe('800000');
  });

  it('normalizes amount and date inputs while recalculating maturity', () => {
    const { result } = renderHook(() => useStartSavingsController());

    act(() => {
      result.current.setContributionAmount('₦50,000');
      result.current.setFrequency('weekly');
      result.current.setStartDate('2026-05-21T10:00:00.000Z');
      result.current.setTargetAmount('₦800,000');
    });

    expect(result.current.contributionAmount).toBe('50000');
    expect(result.current.frequency).toBe('weekly');
    expect(result.current.startDate).toBe('2026-05-21');
    expect(result.current.targetValue).toBe(800000);
    expect(result.current.maturityDate).toBe('2026-09-03');
  });

  it('derives explicit initial contribution and top-up amounts', () => {
    const { result } = renderHook(() => useStartSavingsController());

    act(() => {
      result.current.setContributionAmount('20000');
      result.current.setInitialContributionEnabled(true);
      result.current.setInitialContributionAmount('₦50,000');
    });

    expect(result.current.initialContributionAmount).toBe('50000');
    expect(result.current.effectiveInitialContribution).toBe(50000);
    expect(result.current.requiredTopUpAmount).toBe(0);
  });

  it('clears initial contribution state when switching to auto debit', () => {
    const { result } = renderHook(() => useStartSavingsController());

    act(() => {
      result.current.setInitialContributionEnabled(true);
      result.current.setInitialContributionAmount('₦50,000');
      result.current.handleContinue();
    });
    expect(result.current.initialContributionEnabled).toBe(true);
    expect(result.current.initialContributionAmount).toBe('50000');
    expect(result.current.formError).toBe(
      'Select the product you want to save for.'
    );

    act(() => {
      result.current.handleSourceModeChange('auto_debit');
    });

    expect(result.current.sourceMode).toBe('auto_debit');
    expect(result.current.initialContributionEnabled).toBe(false);
    expect(result.current.initialContributionAmount).toBe('');
    expect(result.current.formError).toBeNull();
    expect(mockSetPaymentMethodsError).toHaveBeenCalledWith(null);
  });

  it('requires a saved payment method for auto-debit funding continue', async () => {
    const { result } = renderHook(() => useStartSavingsController());

    act(() => {
      result.current.handleSourceModeChange('auto_debit');
    });
    await act(async () => {
      await result.current.handleFundingContinue();
    });

    expect(mockSetPaymentMethodsError).toHaveBeenCalledWith(
      'Select a saved card or authorize a new Paystack card.'
    );
    expect(mockSubmitSavingsGoal).not.toHaveBeenCalled();
  });

  it('opens transfer modal for manual bank transfer funding', async () => {
    const { result } = renderHook(() => useStartSavingsController());

    act(() => {
      result.current.setSelectedFundingOption('bank_transfer');
      result.current.setShowFundingModal(true);
    });
    await act(async () => {
      await result.current.handleFundingContinue();
    });

    expect(result.current.showFundingModal).toBe(false);
    expect(result.current.showTransferModal).toBe(true);
  });
});
