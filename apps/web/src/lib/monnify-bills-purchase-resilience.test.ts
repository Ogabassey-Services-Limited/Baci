import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCacheLife, mockCacheTag } = vi.hoisted(() => ({
  mockCacheLife: vi.fn(),
  mockCacheTag: vi.fn(),
}));

vi.mock('next/cache', () => ({
  cacheLife: mockCacheLife,
  cacheTag: mockCacheTag,
}));

vi.mock('@/lib/monnify', () => ({
  getMonnifyToken: vi.fn().mockResolvedValue('mock-token'),
}));

vi.mock('@/lib/monnify-provider-config', () => ({
  getMonnifyBaseUrl: () => 'https://sandbox.monnify.com',
}));

import { purchaseBill } from './monnify-bills';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Monnify bill purchase resilience', () => {
  it('throws a retryable transient error for timeouts, network issues, and HTTP 5xx before transactionReference is known', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    });

    await expect(
      purchaseBill(
        'IKEDC',
        'IKEDC-PREPAID',
        '12345678',
        2000,
        'JANE DOE',
        'BACI-REF-123'
      )
    ).rejects.toThrow('Transient vend outcome');
  });

  it('does not abort vend requests at the old five second timeout', async () => {
    vi.useFakeTimers();
    try {
      const abortError = new Error('aborted');
      abortError.name = 'AbortError';
      let settled = false;

      global.fetch = vi.fn((_url, init?: RequestInit): Promise<Response> => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(abortError);
          });
        });
      });

      const resultPromise = purchaseBill(
        'IKEDC',
        'IKEDC-PREPAID',
        '12345678',
        2000,
        'JANE DOE',
        'BACI-REF-123'
      )
        .then((result) => result)
        .catch((error: unknown) => error)
        .finally(() => {
          settled = true;
        });

      await Promise.resolve();
      expect(global.fetch).toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(5000);
      expect(settled).toBe(false);

      await vi.advanceTimersByTimeAsync(25_000);
      const result = await resultPromise;
      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toContain('Transient vend outcome');
    } finally {
      vi.useRealTimers();
    }
  });

  it('throws a retryable transient error when processing response lacks transactionReference', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        requestSuccessful: true,
        responseCode: '0',
        responseMessage: 'Processing',
        responseBody: {
          vendStatus: 'IN_PROGRESS',
        },
      }),
    });

    await expect(
      purchaseBill(
        'IKEDC',
        'IKEDC-PREPAID',
        '12345678',
        2000,
        'JANE DOE',
        'BACI-REF-123'
      )
    ).rejects.toThrow('missing a requeryable vend reference');
  });

  it('accepts a success response that has vendReference but no transactionReference', async () => {
    // Monnify resolves requery by vendReference, so a vendReference alone is a
    // valid tracking handle — the vend should not be treated as transient.
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        requestSuccessful: true,
        responseCode: '0',
        responseMessage: 'success',
        responseBody: {
          vendReference: 'MFBP-MDR-12345678-260625173742f9cb',
          vendStatus: 'SUCCESS',
          metaData: { token: '1111-2222-3333-4444-5555', unit: '3.2' },
        },
      }),
    });

    const result = await purchaseBill(
      'IKEDC',
      'IKEDC-PREPAID',
      '12345678',
      2000,
      'JANE DOE',
      'BACI-REF-123'
    );
    expect(result.status).toBe('successful');
    expect(result.transactionId).toBe('MFBP-MDR-12345678-260625173742f9cb');
    expect(result.providerVendReference).toBe(
      'MFBP-MDR-12345678-260625173742f9cb'
    );
    expect(result.pin).toBe('1111-2222-3333-4444-5555');
  });
});
