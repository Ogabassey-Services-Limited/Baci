import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTaxMutations } from '@/hooks/useTaxMutations';

const { mockAlert, mockUpdateMerchantSettings } = vi.hoisted(() => ({
  mockAlert: vi.fn(),
  mockUpdateMerchantSettings: vi.fn(),
}));

vi.mock('react-native', () => ({
  Alert: {
    alert: mockAlert,
  },
}));

vi.mock('@/lib/merchant-settings', () => ({
  updateMerchantSettings: (...args: unknown[]) =>
    mockUpdateMerchantSettings(...args),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return {
    queryClient,
    Wrapper,
  };
}

describe('useTaxMutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates VAT settings and invalidates merchant data', async () => {
    const setVatEnabled = vi.fn();
    const { queryClient, Wrapper } = createWrapper();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    mockUpdateMerchantSettings.mockResolvedValueOnce(undefined);

    const { result } = renderHook(
      () =>
        useTaxMutations({
          city: '',
          postalCode: '',
          setVatEnabled,
          stateCode: 'NG-LA',
          street: '',
        }),
      { wrapper: Wrapper }
    );

    await act(async () => {
      await result.current.updateVatMutation.mutateAsync(true);
    });

    expect(setVatEnabled).toHaveBeenCalledWith(true);
    expect(mockUpdateMerchantSettings).toHaveBeenCalledWith({
      vat_registration_status: 'registered',
    });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['merchant'] });
    expect(mockAlert).toHaveBeenCalledWith(
      'Success',
      'VAT has been enabled. 7.5% VAT will be applied to all orders.'
    );
  });

  it('saves the registered address using the selected state name', async () => {
    const { queryClient, Wrapper } = createWrapper();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    mockUpdateMerchantSettings.mockResolvedValueOnce(undefined);

    const { result } = renderHook(
      () =>
        useTaxMutations({
          city: 'Lagos',
          postalCode: '100001',
          setVatEnabled: vi.fn(),
          stateCode: 'NG-LA',
          street: '12 Allen Avenue',
        }),
      { wrapper: Wrapper }
    );

    await act(async () => {
      await result.current.saveAddressMutation.mutateAsync();
    });

    expect(mockUpdateMerchantSettings).toHaveBeenCalledWith({
      registered_address: {
        street: '12 Allen Avenue',
        city: 'Lagos',
        state: 'Lagos',
        postal_code: '100001',
        country: 'Nigeria',
      },
      state_code: 'NG-LA',
    });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['merchant'] });
    expect(mockAlert).toHaveBeenCalledWith(
      'Success',
      'Registered business address saved.'
    );
  });
});
