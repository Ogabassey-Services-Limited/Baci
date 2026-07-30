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
    const response = await requestMerchantPublish(
      '11111111-1111-4111-8111-111111111111',
      false
    );

    expect(fetchWithCsrf).toHaveBeenCalledWith('/api/merchant/publish', {
      method: 'POST',
      body: JSON.stringify({
        merchantId: '11111111-1111-4111-8111-111111111111',
      }),
    });
    expect(response).toBeInstanceOf(Response);
  });

  it('unpublishes stores through the CSRF-aware client', async () => {
    await requestMerchantPublish('22222222-2222-4222-8222-222222222222', true);

    expect(fetchWithCsrf).toHaveBeenCalledWith('/api/merchant/publish', {
      method: 'DELETE',
      body: JSON.stringify({
        merchantId: '22222222-2222-4222-8222-222222222222',
      }),
    });
  });

  it.each([
    null,
    undefined,
  ])('publishes stores when isPublished is %s', async (isPublished) => {
    await requestMerchantPublish(
      '33333333-3333-4333-8333-333333333333',
      isPublished
    );

    expect(fetchWithCsrf).toHaveBeenCalledWith('/api/merchant/publish', {
      method: 'POST',
      body: JSON.stringify({
        merchantId: '33333333-3333-4333-8333-333333333333',
      }),
    });
  });

  it('propagates request failures', async () => {
    const error = new Error('Network error');
    vi.mocked(fetchWithCsrf).mockRejectedValueOnce(error);

    await expect(
      requestMerchantPublish('44444444-4444-4444-8444-444444444444', false)
    ).rejects.toThrow(error);
  });
});
