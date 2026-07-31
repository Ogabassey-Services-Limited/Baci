import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFetchWithCsrf = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client', () => ({
  fetchWithCsrf: mockFetchWithCsrf,
}));

import { useBillPaymentVerification } from './useBillPaymentVerification';

const mockFetch = vi.fn();
global.fetch = mockFetch;

interface MockFetchResponse {
  json: () => Promise<unknown>;
  ok: boolean;
  statusText?: string;
}

function createDeferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
}

describe('useBillPaymentVerification', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetchWithCsrf.mockReset();
    mockFetchWithCsrf.mockImplementation(mockFetch);
  });

  it('uses the CSRF-aware client for meter verification', async () => {
    mockFetchWithCsrf.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ verified: true }),
    });

    const { result } = renderHook(() => useBillPaymentVerification());

    await act(async () => {
      await result.current.verify(
        {
          provider: 'kuda',
          billItemIdentifier: 'IKEDC-PREPAID',
          customerIdentifier: '0102030405',
        },
        'kuda|IKEDC-PREPAID|0102030405'
      );
    });

    expect(mockFetchWithCsrf).toHaveBeenCalledWith('/api/vtu/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'kuda',
        billItemIdentifier: 'IKEDC-PREPAID',
        customerIdentifier: '0102030405',
      }),
      signal: expect.any(AbortSignal),
    });
  });

  it('stores successful verification responses with the current input key', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          verified: true,
          customerName: 'John Doe',
          requireValidationRef: false,
        }),
    });

    const { result } = renderHook(() => useBillPaymentVerification());

    await act(async () => {
      await result.current.verify(
        {
          provider: 'kuda',
          billItemIdentifier: 'DSTV',
          customerIdentifier: '1234567890',
        },
        'kuda|DSTV|1234567890'
      );
    });

    expect(result.current.verification).toEqual({
      verified: true,
      customerName: 'John Doe',
      inputKey: 'kuda|DSTV|1234567890',
      requireValidationRef: false,
    });
    expect(result.current.verifying).toBe(false);
  });

  it('captures the meter address from the verification response', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          verified: true,
          customerName: 'Jane Meter',
          address: '12 Marina Road, Lagos',
        }),
    });

    const { result } = renderHook(() => useBillPaymentVerification());

    await act(async () => {
      await result.current.verify(
        {
          provider: 'monnify',
          billerCode: 'IKEDC',
          productCode: 'IKEDC-PREPAID',
          customerIdentifier: '0102030405',
        },
        'monnify|IKEDC|IKEDC-PREPAID|0102030405'
      );
    });

    expect(result.current.verification).toMatchObject({
      verified: true,
      customerName: 'Jane Meter',
      address: '12 Marina Road, Lagos',
    });
  });

  it('uses non-OK response bodies as verification failures', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      statusText: 'Bad Request',
      json: () => Promise.resolve({ error: 'Invalid customer identifier' }),
    });

    const { result } = renderHook(() => useBillPaymentVerification());

    await act(async () => {
      await result.current.verify(
        {
          provider: 'kuda',
          billItemIdentifier: 'DSTV',
          customerIdentifier: '1234567890',
        },
        'kuda|DSTV|1234567890'
      );
    });

    expect(result.current.verification).toEqual({
      verified: false,
      inputKey: 'kuda|DSTV|1234567890',
      message: 'Invalid customer identifier',
    });
    expect(result.current.verifying).toBe(false);
  });

  it('ignores a cleared stale request when the fetch resolves later', async () => {
    const firstVerification = createDeferred<MockFetchResponse>();
    mockFetch.mockReturnValueOnce(firstVerification.promise);
    const { result } = renderHook(() => useBillPaymentVerification());

    act(() => {
      void result.current.verify(
        {
          provider: 'kuda',
          billItemIdentifier: 'DSTV',
          customerIdentifier: '1111111111',
        },
        'kuda|DSTV|1111111111'
      );
    });

    await waitFor(() => {
      expect(result.current.verifying).toBe(true);
    });

    act(() => {
      result.current.setVerification(null);
    });

    await waitFor(() => {
      expect(result.current.verifying).toBe(false);
    });

    await act(async () => {
      firstVerification.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            verified: true,
            customerName: 'Stale Customer',
          }),
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.verification).toBeNull();
  });
});
