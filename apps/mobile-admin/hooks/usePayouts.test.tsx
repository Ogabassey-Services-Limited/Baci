import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePayouts } from '@/hooks/usePayouts';

const { merchantMock, mockApiClient, mockInvalidateStoreReadiness } =
  vi.hoisted(() => ({
    merchantMock: vi.fn(),
    mockApiClient: vi.fn(),
    mockInvalidateStoreReadiness: vi.fn().mockResolvedValue(undefined),
  }));

vi.mock('@/lib/api-client', () => ({
  apiClient: (...args: unknown[]) => mockApiClient(...args),
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: merchantMock,
}));

vi.mock('@/lib/invalidate-store-readiness', () => ({
  invalidateStoreReadiness: mockInvalidateStoreReadiness,
}));

let currentMerchant: { id: string } | null = { id: 'merchant-1' };

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  return { queryClient, Wrapper };
}

describe('usePayouts', () => {
  beforeEach(() => {
    merchantMock.mockReset();
    mockApiClient.mockReset();
    mockInvalidateStoreReadiness.mockReset();
    mockInvalidateStoreReadiness.mockResolvedValue(undefined);
    currentMerchant = { id: 'merchant-1' };
    merchantMock.mockImplementation(() => ({ merchant: currentMerchant }));
  });

  it('resolves accounts through the canonical paystack route', async () => {
    mockApiClient.mockResolvedValueOnce({
      account_name: 'Jane Doe',
      account_number: '1234567890',
      bank_id: null,
    });

    const { result } = renderHook(() => usePayouts(), {
      wrapper: createWrapper().Wrapper,
    });

    await act(async () => {
      await result.current.resolveAccount.mutateAsync({
        account_number: '1234567890',
        bank_code: '044',
      });
    });

    expect(mockApiClient).toHaveBeenCalledWith('/api/paystack/resolve', {
      method: 'POST',
      body: JSON.stringify({
        account_number: '1234567890',
        bank_code: '044',
      }),
    });
  });

  it('sends and invalidates only the merchant captured when the payout save starts', async () => {
    mockApiClient.mockResolvedValueOnce({ subaccount_code: 'SUB_123' });

    const { result } = renderHook(() => usePayouts(), {
      wrapper: createWrapper().Wrapper,
    });

    await act(async () => {
      await result.current.savePayoutSettings.mutateAsync({
        accountNumber: '1234567890',
        bankCode: '044',
        businessName: 'Baci Store',
      });
    });

    expect(mockApiClient).toHaveBeenCalledWith('/api/paystack/subaccount', {
      method: 'POST',
      body: JSON.stringify({
        accountNumber: '1234567890',
        bankCode: '044',
        businessName: 'Baci Store',
        merchantId: 'merchant-1',
      }),
    });

    expect(mockInvalidateStoreReadiness).toHaveBeenCalledWith(
      expect.anything(),
      'merchant-1'
    );
  });

  it('does not invalidate readiness when payout saving fails', async () => {
    mockApiClient.mockRejectedValueOnce(new Error('payout failed'));

    const { result } = renderHook(() => usePayouts(), {
      wrapper: createWrapper().Wrapper,
    });

    await act(async () => {
      await expect(
        result.current.savePayoutSettings.mutateAsync({
          accountNumber: '1234567890',
          bankCode: '044',
          businessName: 'Baci Store',
        })
      ).rejects.toThrow('payout failed');
    });

    expect(mockInvalidateStoreReadiness).not.toHaveBeenCalled();
  });

  it('starts all payout refreshes together and waits for each before mutation completion', async () => {
    mockApiClient.mockResolvedValueOnce({ subaccount_code: 'SUB_123' });
    const { queryClient, Wrapper } = createWrapper();
    const releases: Array<() => void> = [];
    const deferred = () =>
      new Promise<void>((resolve) => releases.push(resolve));
    vi.spyOn(queryClient, 'invalidateQueries').mockImplementation(deferred);
    mockInvalidateStoreReadiness.mockImplementation(deferred);
    const { result } = renderHook(() => usePayouts(), { wrapper: Wrapper });
    let completed = false;
    let save!: Promise<void>;
    await act(async () => {
      save = result.current.savePayoutSettings
        .mutateAsync({
          accountNumber: '1234567890',
          bankCode: '044',
          businessName: 'Baci Store',
        })
        .then(() => {
          completed = true;
        });
      await vi.waitFor(() => expect(releases).toHaveLength(3));
    });

    expect(completed).toBe(false);
    await act(async () => {
      for (const release of releases) release();
      await save;
    });
    expect(completed).toBe(true);
  });

  it('does not save payout settings when merchant context is unavailable', async () => {
    currentMerchant = null;
    const { queryClient, Wrapper } = createWrapper();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => usePayouts(), { wrapper: Wrapper });

    await expect(
      result.current.savePayoutSettings.mutateAsync({
        accountNumber: '1234567890',
        bankCode: '044',
        businessName: 'Baci Store',
      })
    ).rejects.toThrow('Merchant not loaded. Please try again.');
    expect(mockApiClient).not.toHaveBeenCalled();
    expect(invalidateQueries).not.toHaveBeenCalled();
    expect(mockInvalidateStoreReadiness).not.toHaveBeenCalled();
  });

  it('uses the trimmed merchant id captured at mutation start after merchant context disappears', async () => {
    currentMerchant = { id: ' merchant-1 ' };
    let releaseSave!: () => void;
    const response = new Promise<{ subaccount_code: string }>((resolve) => {
      releaseSave = () => resolve({ subaccount_code: 'SUB_123' });
    });
    mockApiClient.mockReturnValueOnce(response);
    const { queryClient, Wrapper } = createWrapper();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    const { result, rerender } = renderHook(() => usePayouts(), {
      wrapper: Wrapper,
    });
    let save!: Promise<unknown>;
    await act(async () => {
      save = result.current.savePayoutSettings.mutateAsync({
        accountNumber: '1234567890',
        bankCode: '044',
        businessName: 'Baci Store',
      });
      await vi.waitFor(() => expect(mockApiClient).toHaveBeenCalled());
    });

    await act(async () => {
      currentMerchant = null;
      rerender();
      releaseSave();
      await expect(save).resolves.toEqual({ subaccount_code: 'SUB_123' });
    });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['merchant'] });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['merchant-payout'],
    });
    expect(mockInvalidateStoreReadiness).toHaveBeenCalledWith(
      queryClient,
      'merchant-1'
    );
  });

  it('does not expose merchant A payout saving as pending after switching to merchant B', async () => {
    let releaseSave!: () => void;
    const response = new Promise<{ subaccount_code: string }>((resolve) => {
      releaseSave = () => resolve({ subaccount_code: 'SUB_123' });
    });
    mockApiClient.mockReturnValueOnce(response);
    const { Wrapper } = createWrapper();
    const { result, rerender } = renderHook(() => usePayouts(), {
      wrapper: Wrapper,
    });

    let save!: Promise<unknown>;
    await act(async () => {
      save = result.current.savePayoutSettings.mutateAsync({
        accountNumber: '1234567890',
        bankCode: '044',
        businessName: 'Merchant A Store',
      });
      await vi.waitFor(() => expect(mockApiClient).toHaveBeenCalled());
    });
    expect(result.current.savePayoutSettings.isPending).toBe(true);

    currentMerchant = { id: 'merchant-2' };
    rerender();

    expect(result.current.savePayoutSettings.isPending).toBe(false);

    await act(async () => {
      releaseSave();
      await save;
    });
  });

  it('does not expose internal mutation variables from the payout save API', () => {
    const { result } = renderHook(() => usePayouts(), {
      wrapper: createWrapper().Wrapper,
    });

    expect('variables' in result.current.savePayoutSettings).toBe(false);
    expect(Object.keys(result.current.savePayoutSettings).sort()).toEqual([
      'isPending',
      'mutate',
      'mutateAsync',
    ]);
  });

  it('preserves a successful save when only readiness invalidation fails', async () => {
    mockApiClient.mockResolvedValueOnce({ subaccount_code: 'SUB_123' });
    mockInvalidateStoreReadiness.mockRejectedValueOnce(
      new Error('Readiness refresh failed')
    );
    const { result } = renderHook(() => usePayouts(), {
      wrapper: createWrapper().Wrapper,
    });

    await act(async () => {
      await expect(
        result.current.savePayoutSettings.mutateAsync({
          accountNumber: '1234567890',
          bankCode: '044',
          businessName: 'Baci Store',
        })
      ).resolves.toEqual({ subaccount_code: 'SUB_123' });
    });
  });
});
