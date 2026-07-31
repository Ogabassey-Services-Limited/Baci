import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createPostRequest,
  mockAuthenticateApiRequest,
  mockGetMerchantForApiRequest,
  mockGetUser,
  POST,
  selectedMerchantId,
  setupPostRouteTest,
} from './route.post.test-support';

describe('POST /api/paystack/virtual-terminal authorization', () => {
  beforeEach(setupPostRouteTest);

  it('returns 401 when not authenticated', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({
      error: 'Not authenticated',
      supabase: null,
      user: null,
    });

    const res = await POST(createPostRequest({ name: 'Test Terminal' }));

    expect(res.status).toBe(401);
  });

  it('requires an explicit merchant ID before resolving terminal creation access', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u-1' } } });

    const res = await POST(
      new NextRequest('http://localhost/api/paystack/virtual-terminal', {
        body: JSON.stringify({ name: 'Test Terminal' }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
    );

    expect(res.status).toBe(400);
    expect(mockGetMerchantForApiRequest).not.toHaveBeenCalled();
  });

  it('returns 404 when merchant not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u-1' } } });
    mockGetMerchantForApiRequest.mockResolvedValue(null);

    const res = await POST(createPostRequest({ name: 'Test Terminal' }));

    expect(res.status).toBe(404);
    expect(mockGetMerchantForApiRequest).toHaveBeenCalledWith(
      expect.anything(),
      'u-1',
      { requestedMerchantId: selectedMerchantId }
    );
  });
});
