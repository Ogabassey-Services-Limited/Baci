import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockFetchWithCsrf = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client', () => ({ fetchWithCsrf: mockFetchWithCsrf }));

import { uploadProductCsv } from './upload-product-csv';

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

    const request = mockFetchWithCsrf.mock.calls[0]?.[1] as RequestInit;
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
      const options = args[1] as RequestInit | undefined;
      if (!options?.signal) {
        return Promise.resolve({ ok: true, json: async () => ({}) });
      }

      return new Promise((_, reject) => {
        options.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    });

    const result = uploadProductCsv(
      new File(['name'], 'products.csv', { type: 'text/csv' })
    );
    await vi.advanceTimersByTimeAsync(30_000);

    await expect(result).resolves.toMatchObject({ status: 'error' });
    const request = mockFetchWithCsrf.mock.calls.at(-1)?.[1] as RequestInit;
    expect(request.signal?.aborted).toBe(true);
  });
});
