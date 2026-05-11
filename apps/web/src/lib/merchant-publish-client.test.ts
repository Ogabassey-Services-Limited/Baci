import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchWithCsrf } from '@/lib/api-client';
import { requestMerchantPublish } from '@/lib/merchant-publish-client';

vi.mock('@/lib/api-client', () => ({
  fetchWithCsrf: vi.fn(),
}));

describe('requestMerchantPublish', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchWithCsrf).mockResolvedValue(new Response('{}'));
  });

  it('publishes stores through the CSRF-aware client', async () => {
    const response = await requestMerchantPublish(false);

    expect(fetchWithCsrf).toHaveBeenCalledWith('/api/merchant/publish', {
      method: 'POST',
    });
    expect(response).toBeInstanceOf(Response);
  });

  it('unpublishes stores through the CSRF-aware client', async () => {
    await requestMerchantPublish(true);

    expect(fetchWithCsrf).toHaveBeenCalledWith('/api/merchant/publish', {
      method: 'DELETE',
    });
  });

  it.each([
    null,
    undefined,
  ])('publishes stores when isPublished is %s', async (isPublished) => {
    await requestMerchantPublish(isPublished);

    expect(fetchWithCsrf).toHaveBeenCalledWith('/api/merchant/publish', {
      method: 'POST',
    });
  });

  it('propagates request failures', async () => {
    const error = new Error('Network error');
    vi.mocked(fetchWithCsrf).mockRejectedValueOnce(error);

    await expect(requestMerchantPublish(false)).rejects.toThrow(error);
  });
});
