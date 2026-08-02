import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTaxMutations } from '@/hooks/useTaxMutations';

const { mockAlert, mockUpdateMerchantSettings } = vi.hoisted(() => ({
  mockAlert: vi.fn(),
  mockUpdateMerchantSettings: vi.fn(),
}));

vi.mock('react-native', () => ({
  Alert: { alert: mockAlert },
}));

vi.mock('@/lib/merchant-settings', () => ({
  updateMerchantSettings: (...args: unknown[]) =>
    mockUpdateMerchantSettings(...args),
}));

function createDeferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
  return {
    queryClient,
    Wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  };
}

function renderTaxMutations(setVatEnabled: Dispatch<SetStateAction<boolean>>) {
  const { queryClient, Wrapper } = createWrapper();
  const hook = renderHook(
    ({ merchantId }: { merchantId: string }) =>
      useTaxMutations({
        city: 'Lagos',
        merchantId,
        postalCode: '100001',
        setVatEnabled,
        stateCode: 'NG-LA',
        street: '12 Allen Avenue',
      }),
    { initialProps: { merchantId: 'merchant-a' }, wrapper: Wrapper }
  );
  return { ...hook, queryClient };
}

function startAllMutations(
  current: ReturnType<typeof useTaxMutations>
): Promise<unknown>[] {
  return [
    current.updateVatMutation.mutateAsync(true),
    current.saveTinMutation.mutateAsync('1234567890'),
    current.saveLegalEntityMutation.mutateAsync('Merchant A Limited'),
    current.saveAddressMutation.mutateAsync(),
  ];
}

describe('useTaxMutations merchant-switch lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps writes on merchant A when switching to B before mutation functions start', async () => {
    mockUpdateMerchantSettings.mockResolvedValue(undefined);
    const setVatEnabled = vi.fn();
    const { rerender, result } = renderTaxMutations(setVatEnabled);

    const completions = startAllMutations(result.current);
    rerender({ merchantId: 'merchant-b' });
    await act(async () => {
      await Promise.all(completions);
    });

    expect(mockUpdateMerchantSettings).toHaveBeenCalledTimes(4);
    for (const [submittedMerchantId] of mockUpdateMerchantSettings.mock.calls) {
      expect(submittedMerchantId).toBe('merchant-a');
    }
    expect(setVatEnabled).toHaveBeenCalledOnce();
    expect(setVatEnabled).toHaveBeenCalledWith(true);
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('invalidates merchant A tax saves but suppresses stale success UI after switching to B', async () => {
    const deferredWrites = Array.from({ length: 4 }, createDeferred);
    deferredWrites.forEach(({ promise }) => {
      mockUpdateMerchantSettings.mockReturnValueOnce(promise);
    });
    const setVatEnabled = vi.fn();
    const { queryClient, rerender, result } = renderTaxMutations(setVatEnabled);
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    const completions = startAllMutations(result.current);
    await waitFor(() =>
      expect(mockUpdateMerchantSettings).toHaveBeenCalledTimes(4)
    );
    rerender({ merchantId: 'merchant-b' });
    for (const [index, { resolve }] of deferredWrites.entries()) {
      await act(async () => {
        resolve();
        await completions[index];
      });
      expect(invalidateQueries).toHaveBeenCalledTimes(index + 1);
      expect(invalidateQueries).toHaveBeenLastCalledWith({
        queryKey: ['merchant'],
      });
    }

    for (const [submittedMerchantId] of mockUpdateMerchantSettings.mock.calls) {
      expect(submittedMerchantId).toBe('merchant-a');
    }
    expect(setVatEnabled).toHaveBeenCalledOnce();
    expect(setVatEnabled).toHaveBeenCalledWith(true);
    expect(invalidateQueries).toHaveBeenCalledTimes(4);
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('does not expose merchant A tax saves as pending after switching to B', async () => {
    const deferredWrites = Array.from({ length: 4 }, createDeferred);
    deferredWrites.forEach(({ promise }) => {
      mockUpdateMerchantSettings.mockReturnValueOnce(promise);
    });
    const { rerender, result } = renderTaxMutations(vi.fn());

    const completions = startAllMutations(result.current);
    await waitFor(() =>
      expect(mockUpdateMerchantSettings).toHaveBeenCalledTimes(4)
    );
    expect(result.current.updateVatMutation.isPending).toBe(true);
    expect(result.current.saveTinMutation.isPending).toBe(true);
    expect(result.current.saveLegalEntityMutation.isPending).toBe(true);
    expect(result.current.saveAddressMutation.isPending).toBe(true);

    rerender({ merchantId: 'merchant-b' });

    expect(result.current.updateVatMutation.isPending).toBe(false);
    expect(result.current.saveTinMutation.isPending).toBe(false);
    expect(result.current.saveLegalEntityMutation.isPending).toBe(false);
    expect(result.current.saveAddressMutation.isPending).toBe(false);

    await act(async () => {
      deferredWrites.forEach(({ resolve }) => {
        resolve();
      });
      await Promise.all(completions);
    });
  });

  it('suppresses stale error alerts and VAT rollback after switching to B', async () => {
    const deferredWrites = Array.from({ length: 4 }, createDeferred);
    deferredWrites.forEach(({ promise }) => {
      mockUpdateMerchantSettings.mockReturnValueOnce(promise);
    });
    const setVatEnabled = vi.fn();
    const { queryClient, rerender, result } = renderTaxMutations(setVatEnabled);
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    const completions = startAllMutations(result.current).map((completion) =>
      completion.catch((error: unknown) => error)
    );
    await waitFor(() =>
      expect(mockUpdateMerchantSettings).toHaveBeenCalledTimes(4)
    );
    rerender({ merchantId: 'merchant-b' });
    await act(async () => {
      deferredWrites.forEach(({ reject }, index) => {
        reject(new Error(`write ${index + 1} failed`));
      });
      await Promise.all(completions);
    });

    for (const [submittedMerchantId] of mockUpdateMerchantSettings.mock.calls) {
      expect(submittedMerchantId).toBe('merchant-a');
    }
    expect(setVatEnabled).toHaveBeenCalledOnce();
    expect(setVatEnabled).toHaveBeenCalledWith(true);
    expect(invalidateQueries).not.toHaveBeenCalled();
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('does not treat an A completion as current after an A-to-B-to-A switch', async () => {
    const deferredWrite = createDeferred();
    mockUpdateMerchantSettings.mockReturnValueOnce(deferredWrite.promise);
    const setVatEnabled = vi.fn();
    const { queryClient, rerender, result } = renderTaxMutations(setVatEnabled);
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    const completion = result.current.updateVatMutation.mutateAsync(true);
    await waitFor(() =>
      expect(mockUpdateMerchantSettings).toHaveBeenCalledOnce()
    );
    rerender({ merchantId: 'merchant-b' });
    rerender({ merchantId: 'merchant-a' });
    await act(async () => {
      deferredWrite.resolve();
      await completion;
    });

    expect(mockUpdateMerchantSettings).toHaveBeenCalledWith('merchant-a', {
      vat_registration_status: 'registered',
    });
    expect(setVatEnabled).toHaveBeenCalledOnce();
    expect(setVatEnabled).toHaveBeenCalledWith(true);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['merchant'],
    });
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('does not roll back an A toggle after an A-to-B-to-A switch', async () => {
    const deferredWrite = createDeferred();
    mockUpdateMerchantSettings.mockReturnValueOnce(deferredWrite.promise);
    const setVatEnabled = vi.fn();
    const { rerender, result } = renderTaxMutations(setVatEnabled);

    const completion = result.current.updateVatMutation
      .mutateAsync(true)
      .catch((error: unknown) => error);
    await waitFor(() =>
      expect(mockUpdateMerchantSettings).toHaveBeenCalledOnce()
    );
    rerender({ merchantId: 'merchant-b' });
    rerender({ merchantId: 'merchant-a' });
    await act(async () => {
      deferredWrite.reject(new Error('merchant A write failed'));
      await completion;
    });

    expect(setVatEnabled).toHaveBeenCalledOnce();
    expect(setVatEnabled).toHaveBeenCalledWith(true);
    expect(mockAlert).not.toHaveBeenCalled();
  });
});
