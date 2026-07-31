import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMerchantFeatures } from './use-merchant-feature-settings';

const mocks = vi.hoisted(() => ({
  fetchWithCsrf: vi.fn(),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

vi.mock('@/lib/api-client', () => ({
  fetchWithCsrf: (...args: unknown[]) => mocks.fetchWithCsrf(...args),
}));

describe('useMerchantFeatures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('fetches merchant feature settings', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          id: 'feat-1',
          merchant_id: 'm-1',
          loyalty_enabled: true,
          reviews_enabled: true,
          blog_enabled: false,
        }),
    } as Response);

    const { result } = renderHook(() => useMerchantFeatures('m-1'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(fetch).toHaveBeenCalledWith('/api/merchant/features?merchantId=m-1');
    expect(result.current.loyaltyEnabled).toBe(true);
  });

  it('handles fetch error', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Unauthorized' }),
    } as Response);

    const { result } = renderHook(() => useMerchantFeatures('m-1'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe('Unauthorized');
  });

  it('writes feature settings only for the selected merchant', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({ merchant_id: 'm-1', loyalty_enabled: false }),
    } as Response);
    mocks.fetchWithCsrf.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({ merchant_id: 'm-1', loyalty_enabled: true }),
    } as Response);
    const { result } = renderHook(() => useMerchantFeatures('m-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await result.current.updateSettings({ loyalty_enabled: true });

    expect(mocks.fetchWithCsrf).toHaveBeenCalledWith('/api/merchant/features', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loyalty_enabled: true, merchantId: 'm-1' }),
    });
  });

  it('resets immediately and ignores a stale fetch after the merchant changes', async () => {
    const merchantOneResponse = deferred<Response>();
    vi.mocked(fetch)
      .mockReturnValueOnce(merchantOneResponse.promise)
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ merchant_id: 'm-2', loyalty_enabled: false }),
      } as Response);
    const { result, rerender } = renderHook(
      ({ merchantId }) => useMerchantFeatures(merchantId),
      { initialProps: { merchantId: 'm-1' } }
    );

    rerender({ merchantId: 'm-2' });
    expect(result.current.settings).toBeNull();
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      merchantOneResponse.resolve({
        ok: true,
        json: () =>
          Promise.resolve({ merchant_id: 'm-1', loyalty_enabled: true }),
      } as Response);
      await merchantOneResponse.promise;
    });

    expect(result.current.settings?.merchant_id).toBe('m-2');
    expect(result.current.loyaltyEnabled).toBe(false);
  });

  it('ignores a stale update completion after the merchant changes', async () => {
    const updateResponse = deferred<Response>();
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ merchant_id: 'm-1' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ merchant_id: 'm-2' }),
      } as Response);
    mocks.fetchWithCsrf.mockReturnValueOnce(updateResponse.promise);
    const { result, rerender } = renderHook(
      ({ merchantId }) => useMerchantFeatures(merchantId),
      { initialProps: { merchantId: 'm-1' } }
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let updatePromise: Promise<boolean>;
    act(() => {
      updatePromise = result.current.updateSettings({ loyalty_enabled: true });
    });
    rerender({ merchantId: 'm-2' });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      updateResponse.resolve({
        ok: true,
        json: () => Promise.resolve({ merchant_id: 'm-1' }),
      } as Response);
      expect(await updatePromise).toBe(false);
    });

    expect(result.current.settings?.merchant_id).toBe('m-2');
    expect(result.current.isSaving).toBe(false);
  });

  it('ignores an old A fetch after switching A to B and back to A', async () => {
    const oldMerchantAResponse = deferred<Response>();
    vi.mocked(fetch)
      .mockReturnValueOnce(oldMerchantAResponse.promise)
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ merchant_id: 'm-2', loyalty_enabled: false }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ merchant_id: 'm-1', loyalty_enabled: true }),
      } as Response);
    const { result, rerender } = renderHook(
      ({ merchantId }) => useMerchantFeatures(merchantId),
      { initialProps: { merchantId: 'm-1' } }
    );

    rerender({ merchantId: 'm-2' });
    await waitFor(() =>
      expect(result.current.settings?.merchant_id).toBe('m-2')
    );
    rerender({ merchantId: 'm-1' });
    await waitFor(() =>
      expect(result.current.settings?.merchant_id).toBe('m-1')
    );
    expect(result.current.loyaltyEnabled).toBe(true);

    await act(async () => {
      oldMerchantAResponse.resolve({
        ok: true,
        json: () =>
          Promise.resolve({ merchant_id: 'm-1', loyalty_enabled: false }),
      } as Response);
      await oldMerchantAResponse.promise;
    });

    expect(result.current.settings?.merchant_id).toBe('m-1');
    expect(result.current.loyaltyEnabled).toBe(true);
  });

  it('keeps the newest refresh when an older fetch resolves afterward', async () => {
    const initialResponse = deferred<Response>();
    const refreshResponse = deferred<Response>();
    vi.mocked(fetch)
      .mockReturnValueOnce(initialResponse.promise)
      .mockReturnValueOnce(refreshResponse.promise);
    const { result } = renderHook(() => useMerchantFeatures('m-1'));

    let refreshPromise: Promise<void>;
    act(() => {
      refreshPromise = result.current.refresh();
    });
    await act(async () => {
      refreshResponse.resolve({
        ok: true,
        json: () =>
          Promise.resolve({ merchant_id: 'm-1', loyalty_enabled: true }),
      } as Response);
      await refreshPromise;
    });
    expect(result.current.loyaltyEnabled).toBe(true);
    expect(result.current.isLoading).toBe(false);

    await act(async () => {
      initialResponse.resolve({
        ok: true,
        json: () =>
          Promise.resolve({ merchant_id: 'm-1', loyalty_enabled: false }),
      } as Response);
      await initialResponse.promise;
    });

    expect(result.current.loyaltyEnabled).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('keeps the newest update when an older save resolves afterward', async () => {
    const olderUpdate = deferred<Response>();
    const newerUpdate = deferred<Response>();
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({ merchant_id: 'm-1', loyalty_enabled: false }),
    } as Response);
    mocks.fetchWithCsrf
      .mockReturnValueOnce(olderUpdate.promise)
      .mockReturnValueOnce(newerUpdate.promise);
    const { result } = renderHook(() => useMerchantFeatures('m-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let olderPromise: Promise<boolean>;
    let newerPromise: Promise<boolean>;
    act(() => {
      olderPromise = result.current.updateSettings({ loyalty_enabled: true });
      newerPromise = result.current.updateSettings({ loyalty_enabled: false });
    });
    await act(async () => {
      newerUpdate.resolve({
        ok: true,
        json: () =>
          Promise.resolve({ merchant_id: 'm-1', loyalty_enabled: false }),
      } as Response);
      expect(await newerPromise).toBe(true);
    });
    expect(result.current.loyaltyEnabled).toBe(false);
    expect(result.current.isSaving).toBe(false);

    await act(async () => {
      olderUpdate.resolve({
        ok: true,
        json: () =>
          Promise.resolve({ merchant_id: 'm-1', loyalty_enabled: true }),
      } as Response);
      expect(await olderPromise).toBe(false);
    });

    expect(result.current.loyaltyEnabled).toBe(false);
    expect(result.current.isSaving).toBe(false);
    expect(result.current.error).toBeNull();
  });
});
