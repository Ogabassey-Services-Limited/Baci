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

  it('keeps writes on merchant A but suppresses stale success UI after switching to B', async () => {
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
    await act(async () => {
      deferredWrites.forEach(({ resolve }) => {
        resolve();
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
});
