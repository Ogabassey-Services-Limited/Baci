import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getMerchantForApiRequest: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ get: vi.fn(), set: vi.fn() }),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ auth: { getUser: mocks.getUser } }),
}));

vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: mocks.getMerchantForApiRequest,
}));

import { getProductListContext } from './get-product-list-context';

describe('getProductListContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    mocks.getMerchantForApiRequest.mockResolvedValue({
      merchantId: 'merchant-b',
    });
  });

  it('authorizes the requested merchant before loading embedded product ids', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/products?ids=product-b&merchantId=merchant-b'
    );

    const result = await getProductListContext(request);

    expect('response' in result).toBe(false);
    expect(mocks.getMerchantForApiRequest).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      { requestedMerchantId: 'merchant-b' }
    );
  });
});
