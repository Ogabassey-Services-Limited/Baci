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
  StatusBar: () => null,
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
          merchantId: 'merchant-1',
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
    expect(mockUpdateMerchantSettings).toHaveBeenCalledWith('merchant-1', {
      vat_registration_status: 'registered',
    });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['merchant'] });
    expect(mockAlert).toHaveBeenCalledWith(
      'Success',
      'VAT has been enabled. 7.5% VAT will be applied to all orders.'
    );
  });

  it('rolls back the VAT toggle and alerts when the VAT update fails', async () => {
    const setVatEnabled = vi.fn();
    const { queryClient, Wrapper } = createWrapper();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    const mutationError = new Error('VAT update failed');

    mockUpdateMerchantSettings.mockRejectedValueOnce(mutationError);

    const { result } = renderHook(
      () =>
        useTaxMutations({
          city: '',
          merchantId: 'merchant-1',
          postalCode: '',
          setVatEnabled,
          stateCode: 'NG-LA',
          street: '',
        }),
      { wrapper: Wrapper }
    );

    let thrownError: Error | null = null;

    await act(async () => {
      try {
        await result.current.updateVatMutation.mutateAsync(true);
      } catch (error) {
        thrownError = error as Error;
      }
    });

    expect(thrownError).toBe(mutationError);
    expect(setVatEnabled).toHaveBeenNthCalledWith(1, true);
    expect(setVatEnabled).toHaveBeenNthCalledWith(2, false);
    expect(mockAlert).toHaveBeenCalledWith(
      'Error',
      'Failed to update VAT settings. Please try again.'
    );
    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  it('saves the registered address using the selected state name', async () => {
    const { queryClient, Wrapper } = createWrapper();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    mockUpdateMerchantSettings.mockResolvedValueOnce(undefined);

    const { result } = renderHook(
      () =>
        useTaxMutations({
          city: 'Lagos',
          merchantId: 'merchant-1',
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

    expect(mockUpdateMerchantSettings).toHaveBeenCalledWith('merchant-1', {
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

  it('alerts without invalidating merchant data when address save fails', async () => {
    const { queryClient, Wrapper } = createWrapper();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    const mutationError = new Error('Address update failed');

    mockUpdateMerchantSettings.mockRejectedValueOnce(mutationError);

    const { result } = renderHook(
      () =>
        useTaxMutations({
          city: 'Lagos',
          merchantId: 'merchant-1',
          postalCode: '100001',
          setVatEnabled: vi.fn(),
          stateCode: 'NG-LA',
          street: '12 Allen Avenue',
        }),
      { wrapper: Wrapper }
    );

    let thrownError: Error | null = null;

    await act(async () => {
      try {
        await result.current.saveAddressMutation.mutateAsync();
      } catch (error) {
        thrownError = error as Error;
      }
    });

    expect(thrownError).toBe(mutationError);
    expect(mockAlert).toHaveBeenCalledWith(
      'Error',
      'Failed to save address. Please try again.'
    );
    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  it('alerts and skips persistence when the TIN is invalid', async () => {
    const { queryClient, Wrapper } = createWrapper();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(
      () =>
        useTaxMutations({
          city: '',
          merchantId: 'merchant-1',
          postalCode: '',
          setVatEnabled: vi.fn(),
          stateCode: 'NG-LA',
          street: '',
        }),
      { wrapper: Wrapper }
    );

    let thrownError: Error | null = null;

    await act(async () => {
      try {
        await result.current.saveTinMutation.mutateAsync('1234');
      } catch (error) {
        thrownError = error as Error;
      }
    });

    expect(thrownError).toEqual(
      new Error('Nigerian TIN must be exactly 10 digits')
    );
    expect(mockUpdateMerchantSettings).not.toHaveBeenCalled();
    expect(mockAlert).toHaveBeenCalledWith(
      'Error',
      'Nigerian TIN must be exactly 10 digits'
    );
    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  it('does not start public tax mutations without an active merchant', async () => {
    const setVatEnabled = vi.fn();
    const { queryClient, Wrapper } = createWrapper();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(
      () =>
        useTaxMutations({
          city: 'Lagos',
          merchantId: '   ',
          postalCode: '100001',
          setVatEnabled,
          stateCode: 'NG-LA',
          street: '12 Allen Avenue',
        }),
      { wrapper: Wrapper }
    );

    await expect(
      result.current.updateVatMutation.mutateAsync(true)
    ).rejects.toThrow('No merchant found');
    await expect(
      result.current.saveTinMutation.mutateAsync('1234567890')
    ).rejects.toThrow('No merchant found');
    await expect(
      result.current.saveLegalEntityMutation.mutateAsync('Baci Store')
    ).rejects.toThrow('No merchant found');
    await expect(
      result.current.saveAddressMutation.mutateAsync()
    ).rejects.toThrow('No merchant found');
    result.current.updateVatMutation.mutate(true);

    expect(mockUpdateMerchantSettings).not.toHaveBeenCalled();
    expect(setVatEnabled).not.toHaveBeenCalled();
    expect(mockAlert).not.toHaveBeenCalled();
    expect(invalidateQueries).not.toHaveBeenCalled();
  });
});
