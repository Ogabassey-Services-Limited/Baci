import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockFetchWithCsrf = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client', () => ({ fetchWithCsrf: mockFetchWithCsrf }));

import { uploadProductCsv } from './upload-product-csv';

function getRequestOptions(callIndex: number): RequestInit {
  const options = mockFetchWithCsrf.mock.calls[callIndex]?.[1];

  if (!options || typeof options !== 'object') {
    throw new Error('Expected fetchWithCsrf request options');
  }

  return options;
}

describe('uploadProductCsv', () => {
  beforeEach(() => mockFetchWithCsrf.mockReset());

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('uploads the CSV through the CSRF client with its timeout signal', async () => {
    mockFetchWithCsrf.mockResolvedValue({
      ok: true,
      json: async () => ({ success: 1, failed: 0, errors: [] }),
    });
    const file = new File(['name'], 'products.csv', { type: 'text/csv' });

    await expect(uploadProductCsv(file)).resolves.toEqual({
      status: 'ok',
      data: { success: 1, failed: 0, errors: [] },
    });

    const request = getRequestOptions(0);
    expect(request).toMatchObject({
      method: 'POST',
      signal: expect.any(AbortSignal),
    });
    expect((request.body as FormData).get('file')).toBe(file);
  });

  it('returns an error outcome when the upload is rejected', async () => {
    mockFetchWithCsrf.mockResolvedValue({ ok: false });

    await expect(
      uploadProductCsv(new File(['name'], 'products.csv', { type: 'text/csv' }))
    ).resolves.toEqual({ status: 'error', error: new Error('Upload failed') });
  });

  it('aborts an in-flight upload when the timeout expires', async () => {
    vi.useFakeTimers();
    mockFetchWithCsrf.mockImplementation((...args: unknown[]) => {
      const options = args[1];
      if (!options || typeof options !== 'object' || !('signal' in options)) {
        return Promise.resolve({ ok: true, json: async () => ({}) });
      }
      const signal = options.signal;
      if (!(signal instanceof AbortSignal)) {
        return Promise.resolve({ ok: true, json: async () => ({}) });
      }

      return new Promise((_, reject) => {
        signal.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    });

    const result = uploadProductCsv(
      new File(['name'], 'products.csv', { type: 'text/csv' })
    );
    await vi.advanceTimersByTimeAsync(30_000);

    await expect(result).resolves.toMatchObject({ status: 'error' });
    const request = getRequestOptions(mockFetchWithCsrf.mock.calls.length - 1);
    expect(request.signal?.aborted).toBe(true);
  });
});
