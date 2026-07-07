import { notifyManager } from '@tanstack/query-core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { createElement, type PropsWithChildren } from 'react';
import { useUtilityPayment } from '@/hooks/use-utility-payment';

const mockUseMerchantPaymentSettings = jest.fn();
const mockListSavedVtuCards = jest.fn();
let mockWalletQuery: {
  data?: { wallet: { balance: number } };
  error?: Error | null;
  isError?: boolean;
  isLoading?: boolean;
};

jest.mock('@/hooks/useMerchantPaymentSettings', () => ({
  useMerchantPaymentSettings: () => mockUseMerchantPaymentSettings(),
  getEnabledPaymentMethods: jest.fn((settings) => {
    if (!settings) return ['paystack'];
    const methods = [];
    if (settings.paystack_enabled) methods.push('paystack');
    if (settings.korapay_enabled) methods.push('korapay');
    if (settings.paystack_enabled && settings.wallet_paystack_dva_enabled) {
      methods.push('bank_transfer');
    }
    return methods;
  }),
}));

jest.mock('@/lib/vtu-checkout', () => ({
  listSavedVtuCards: () => mockListSavedVtuCards(),
}));

jest.mock('@/hooks/use-wallet', () => ({
  useWallet: () => mockWalletQuery,
}));

const mockAuthState: {
  session: { access_token: string } | null;
  customer: { phone?: string | null } | null;
} = {
  session: { access_token: 'token-123' },
  customer: { phone: '08012345678' },
};

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: (selector: (state: typeof mockAuthState) => unknown) =>
    selector(mockAuthState),
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Number.POSITIVE_INFINITY,
        refetchOnMount: false,
        staleTime: Number.POSITIVE_INFINITY,
      },
    },
  });
}

function createWrapper() {
  return createWrapperWithClient(createTestQueryClient());
}

function createWrapperWithClient(client: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return createElement(QueryClientProvider, { client }, children);
  };
}

beforeAll(() => {
  notifyManager.setNotifyFunction((callback) => {
    act(() => {
      callback();
    });
  });
});

afterAll(() => {
  notifyManager.setNotifyFunction((callback) => {
    callback();
  });
});

describe('useUtilityPayment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthState.session = { access_token: 'token-123' };
    mockAuthState.customer = { phone: '08012345678' };
    mockUseMerchantPaymentSettings.mockReturnValue({
      data: { paystack_enabled: true, korapay_enabled: true },
    });
    mockWalletQuery = {
      data: { wallet: { balance: 0 } },
      error: null,
      isError: false,
      isLoading: false,
    };
    mockListSavedVtuCards.mockResolvedValue([
      {
        id: 'card-1',
        provider: 'paystack',
        label: 'Access Bank ending 1234',
        brand: 'visa',
        bank: 'Access Bank',
        last4: '1234',
        exp_month: '08',
        exp_year: '2030',
        is_default: true,
      },
    ]);
  });

  it('defaults to enabled gateways and selects the default saved card', async () => {
    const { result } = renderHook(() => useUtilityPayment(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.selectedSavedCardId).toBe('card-1');
    });

    expect(result.current.supportedGateways).toEqual(['paystack', 'korapay']);
  });

  it('exposes canFundByBankTransfer when authed and the merchant DVA is enabled', async () => {
    mockUseMerchantPaymentSettings.mockReturnValue({
      data: {
        paystack_enabled: true,
        korapay_enabled: true,
        wallet_paystack_dva_enabled: true,
      },
    });

    const { result } = renderHook(() => useUtilityPayment(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoadingCards).toBe(false);
    });

    expect(result.current.canFundByBankTransfer).toBe(true);
  });

  it('does not expose canFundByBankTransfer when the merchant DVA is disabled', async () => {
    // beforeEach mocks paystack/korapay enabled without wallet DVA.
    const { result } = renderHook(() => useUtilityPayment(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoadingCards).toBe(false);
    });

    expect(result.current.canFundByBankTransfer).toBe(false);
  });

  it('does not expose canFundByBankTransfer when the customer has no phone', async () => {
    mockAuthState.customer = { phone: null };
    mockUseMerchantPaymentSettings.mockReturnValue({
      data: {
        paystack_enabled: true,
        korapay_enabled: true,
        wallet_paystack_dva_enabled: true,
      },
    });

    const { result } = renderHook(() => useUtilityPayment(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoadingCards).toBe(false);
    });

    expect(result.current.canFundByBankTransfer).toBe(false);
  });

  it('never offers bank_transfer as a VTU gateway even when the merchant enables it', async () => {
    mockUseMerchantPaymentSettings.mockReturnValue({
      data: {
        paystack_enabled: true,
        korapay_enabled: true,
        wallet_paystack_dva_enabled: true,
      },
    });

    const { result } = renderHook(() => useUtilityPayment(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoadingCards).toBe(false);
    });

    // Bank transfers are wallet-DVA only: VTU must never route through
    // Paystack's hosted pay-with-transfer channel.
    expect(result.current.supportedGateways).toEqual(['paystack', 'korapay']);
  });

  it('keeps saved card cleared when the user chooses another Paystack card', async () => {
    const { result } = renderHook(() => useUtilityPayment(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.selectedSavedCardId).toBe('card-1');
    });

    act(() => {
      result.current.selectGateway('paystack');
    });

    await waitFor(() => {
      expect(result.current.selectedSavedCardId).toBeNull();
    });
    await act(async () => undefined);
    expect(result.current.selectedGateway).toBe('paystack');
    expect(result.current.selectedSavedCardId).toBeNull();
  });

  it('refetches saved cards when the payment form remounts', async () => {
    const client = createTestQueryClient();
    mockListSavedVtuCards.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        id: 'card-1',
        provider: 'paystack',
        label: 'Access Bank ending 1234',
        brand: 'visa',
        bank: 'Access Bank',
        last4: '1234',
        exp_month: '08',
        exp_year: '2030',
        is_default: true,
      },
    ]);

    const first = renderHook(() => useUtilityPayment(), {
      wrapper: createWrapperWithClient(client),
    });

    await waitFor(
      () => {
        expect(mockListSavedVtuCards).toHaveBeenCalledTimes(1);
        expect(first.result.current.isLoadingCards).toBe(false);
      },
      { timeout: 5000 }
    );
    expect(first.result.current.cards).toEqual([]);

    first.unmount();

    const second = renderHook(() => useUtilityPayment(), {
      wrapper: createWrapperWithClient(client),
    });

    await waitFor(() => {
      expect(mockListSavedVtuCards).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(second.result.current.selectedSavedCardId).toBe('card-1');
    });
  });

  it('clears the saved card when a different gateway is selected', async () => {
    const { result } = renderHook(() => useUtilityPayment(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.selectedSavedCardId).toBe('card-1');
    });

    act(() => {
      result.current.selectGateway('korapay');
    });

    expect(result.current.selectedGateway).toBe('korapay');
    expect(result.current.selectedSavedCardId).toBeNull();
  });

  // Phase B.8 — wallet state is owned by useUtilityPayment so all
  // three VTU controllers (bill / airtime / data) read & write the
  // same selection. Pin the public shape so a future refactor that
  // moves the state elsewhere can't silently break the controllers.
  it('auto-selects wallet payment when a usable balance exists (wallet-first)', async () => {
    mockWalletQuery = {
      data: { wallet: { balance: 1_500 } },
      error: null,
      isError: false,
      isLoading: false,
    };
    const { result } = renderHook(() => useUtilityPayment(500), {
      wrapper: createWrapper(),
    });

    expect(result.current.walletBalance).toBe(1500);
    expect(result.current.walletSelection).toEqual({
      use: true,
      amount: 500,
    });

    act(() => {
      result.current.setWalletSelection({ use: false, amount: 0 });
    });

    expect(result.current.walletSelection).toBeUndefined();
  });

  it('does not auto-select wallet payment when the balance is zero', () => {
    mockWalletQuery = {
      data: { wallet: { balance: 0 } },
      error: null,
      isError: false,
      isLoading: false,
    };
    const { result } = renderHook(() => useUtilityPayment(500), {
      wrapper: createWrapper(),
    });

    expect(result.current.walletSelection).toBeUndefined();
  });

  it('caps the auto-selected wallet amount at the available balance for partial cover', () => {
    mockWalletQuery = {
      data: { wallet: { balance: 300 } },
      error: null,
      isError: false,
      isLoading: false,
    };
    const { result } = renderHook(() => useUtilityPayment(1_000), {
      wrapper: createWrapper(),
    });

    expect(result.current.walletSelection).toEqual({
      use: true,
      amount: 300,
    });
  });

  it('recalculates walletSelection from the latest amount after the wallet is toggled on', async () => {
    mockWalletQuery = {
      data: { wallet: { balance: 1_500 } },
      error: null,
      isError: false,
      isLoading: false,
    };
    let amount = 500;

    const { result, rerender } = renderHook(() => useUtilityPayment(amount), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setWalletSelection({ use: true, amount: 500 });
    });

    expect(result.current.walletSelection).toEqual({
      use: true,
      amount: 500,
    });

    amount = 1_000;
    rerender(undefined);

    expect(result.current.walletSelection).toEqual({
      use: true,
      amount: 1_000,
    });
  });

  it('exposes wallet query loading and error state separately from a zero balance', () => {
    const walletError = new Error('wallet unavailable');
    mockWalletQuery = {
      data: undefined,
      error: walletError,
      isError: true,
      isLoading: false,
    };

    const { result } = renderHook(() => useUtilityPayment(), {
      wrapper: createWrapper(),
    });

    expect(result.current.walletBalance).toBe(0);
    expect(result.current.walletError).toBe(walletError);
    expect(result.current.walletIsLoading).toBe(false);
    expect(result.current.walletCanRender).toBe(false);
  });
});
