import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useBillPaymentBillers } from './useBillPaymentBillers';

const mockFetch = vi.fn();
global.fetch = mockFetch;

function createDeferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
}

describe('useBillPaymentBillers', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('loads billers for the selected tab with Monnify included', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          billers: [
            {
              billerId: 'DSTV',
              billerName: 'DStv',
              billerType: 'cable_tv',
              categoryId: 'cat-1',
              categoryName: 'Cable TV',
              provider: 'kuda',
            },
          ],
        }),
    });

    const { result } = renderHook(() => useBillPaymentBillers('tv'));

    await waitFor(() => {
      expect(result.current.billersLoading).toBe(false);
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/vtu/billers?type=cable_tv&includeMonnify=true',
      expect.objectContaining({
        signal: expect.any(Object),
      })
    );
    expect(mockFetch.mock.calls[0]?.[1]).not.toHaveProperty('cache');
    expect(result.current.billers).toHaveLength(1);
    expect(result.current.billersError).toBeNull();
  });

  it('surfaces provider-specific partial fallback errors', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          billers: [],
          monnifyError: 'Monnify products unavailable',
        }),
    });

    const { result } = renderHook(() => useBillPaymentBillers('power'));

    await waitFor(() => {
      expect(result.current.billersLoading).toBe(false);
    });

    expect(result.current.billers).toEqual([]);
    expect(result.current.billersError).toBe('Monnify products unavailable');
  });

  it('uses non-OK response bodies as biller load failures', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 503,
      json: () => Promise.resolve({ error: 'Biller service unavailable' }),
    });

    const { result } = renderHook(() => useBillPaymentBillers('power'));

    await waitFor(() => {
      expect(result.current.billersLoading).toBe(false);
    });

    expect(result.current.billers).toEqual([]);
    expect(result.current.billersError).toBe('Biller service unavailable');
  });

  it('aborts the in-flight biller request on unmount', async () => {
    const deferred = createDeferred<unknown>();
    mockFetch.mockReturnValue(deferred.promise);

    const { unmount } = renderHook(() => useBillPaymentBillers('tv'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const signal = mockFetch.mock.calls[0]?.[1]?.signal as
      | AbortSignal
      | undefined;
    expect(signal?.aborted).toBe(false);

    unmount();

    expect(signal?.aborted).toBe(true);
  });

  it('prefers Monnify partial errors over Kuda partial errors', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          billers: [],
          kudaError: 'Kuda unavailable',
          monnifyError: 'Monnify products unavailable',
        }),
    });

    const { result } = renderHook(() => useBillPaymentBillers('power'));

    await waitFor(() => {
      expect(result.current.billersLoading).toBe(false);
    });

    expect(result.current.billersError).toBe('Monnify products unavailable');
  });
});
