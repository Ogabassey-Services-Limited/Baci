import { afterEach, describe, expect, it, vi } from 'vitest';

const mockFetchWithCsrf = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client', () => ({ fetchWithCsrf: mockFetchWithCsrf }));

import { uploadProductCsv } from './upload-product-csv';

describe('uploadProductCsv', () => {
  afterEach(() => vi.restoreAllMocks());

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
});
