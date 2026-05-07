import { notifyManager } from '@tanstack/query-core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { createElement, type PropsWithChildren } from 'react';
import { useUtilityPayment } from '@/hooks/use-utility-payment';

const mockUseMerchantPaymentSettings = jest.fn();
const mockListSavedVtuCards = jest.fn();

jest.mock('@/hooks/useMerchantPaymentSettings', () => ({
  useMerchantPaymentSettings: () => mockUseMerchantPaymentSettings(),
  getEnabledPaymentMethods: jest.fn((settings) => {
    if (!settings) return ['paystack'];
    const methods = [];
    if (settings.paystack_enabled) methods.push('paystack');
    if (settings.korapay_enabled) methods.push('korapay');
    return methods;
  }),
}));

jest.mock('@/lib/vtu-checkout', () => ({
  listSavedVtuCards: () => mockListSavedVtuCards(),
}));

jest.mock('@/hooks/use-wallet', () => ({
  useWallet: () => ({ data: { wallet: { balance: 0 } } }),
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: (selector: (state: { session: { access_token: string } }) => unknown) =>
    selector({ session: { access_token: 'token-123' } }),
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
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
    mockUseMerchantPaymentSettings.mockReturnValue({
      data: { paystack_enabled: true, korapay_enabled: true },
    });
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

  it('refetches saved cards when the payment form remounts', async () => {
    const client = createTestQueryClient();
    mockListSavedVtuCards
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
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

    await waitFor(() => {
      expect(mockListSavedVtuCards).toHaveBeenCalledTimes(1);
      expect(first.result.current.isLoadingCards).toBe(false);
    });
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
  it('exposes walletBalance, walletSelection, and setWalletSelection', async () => {
    const { result } = renderHook(() => useUtilityPayment(), {
      wrapper: createWrapper(),
    });

    expect(result.current.walletBalance).toBe(0);
    expect(result.current.walletSelection).toBeUndefined();

    act(() => {
      result.current.setWalletSelection({ use: true, amount: 500 });
    });

    expect(result.current.walletSelection).toEqual({
      use: true,
      amount: 500,
    });
  });
});
