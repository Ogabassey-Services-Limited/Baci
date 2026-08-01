import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFetchWithCsrf = vi.fn();
vi.mock('@/lib/api-client', () => ({
  fetchWithCsrf: (...args: unknown[]) => mockFetchWithCsrf(...args),
}));

import { postCacVerificationRequest } from './cac-verification-request';

describe('postCacVerificationRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a rate-limited result without parsing a response body', async () => {
    mockFetchWithCsrf.mockResolvedValue({ status: 429 });

    await expect(
      postCacVerificationRequest('/api/merchant/cac-search', '{}')
    ).resolves.toEqual({ kind: 'rate-limited' });
  });

  it('sends the requested body through the CSRF-aware client', async () => {
    mockFetchWithCsrf.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ companies: [] }),
    });

    await postCacVerificationRequest('/api/merchant/cac-search', '{}');

    expect(mockFetchWithCsrf).toHaveBeenCalledWith('/api/merchant/cac-search', {
      body: '{}',
      method: 'POST',
    });
  });
});
