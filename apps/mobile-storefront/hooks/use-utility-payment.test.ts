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

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: (selector: (state: { session: { access_token: string } }) => unknown) =>
    selector({ session: { access_token: 'token-123' } }),
}));

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

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
});
