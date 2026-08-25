import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getMerchantForApiRequest: vi.fn(),
  hasPermission: vi.fn(),
  toUserAccess: vi.fn(),
}));

vi.mock('next/headers', () => ({ cookies: vi.fn(async () => ({})) }));
vi.mock('@/lib/api-auth', () => ({ hasPermission: mocks.hasPermission }));
vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: mocks.getMerchantForApiRequest,
  toUserAccess: mocks.toUserAccess,
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}));

import { GET } from './route';

function productsQuery() {
  const query = {
    eq: vi.fn(() => query),
    or: vi.fn(() => query),
    order: vi.fn(() => query),
    range: vi.fn(() => Promise.resolve({ count: 0, data: [], error: null })),
    select: vi.fn(() => query),
  };
  return query;
}

describe('inventory forecast dashboard API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getMerchantForApiRequest.mockResolvedValue({
      merchantId: 'merchant-1',
    });
    mocks.hasPermission.mockReturnValue(true);
    mocks.toUserAccess.mockReturnValue({ permissions: {} });
  });

  it('loads forecasts for the selected merchant with a bounded query', async () => {
    const query = productsQuery();
    const from = vi.fn(() => query);
    mocks.createClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
        }),
      },
      from,
    });
    const requestedMerchantId = '123e4567-e89b-42d3-a456-426614174000';

    const response = await GET(
      new Request('https://usebaci.com/api/inventory/forecast?limit=100', {
        headers: { 'x-baci-merchant-id': requestedMerchantId },
      }) as never
    );

    expect(response.status).toBe(200);
    expect(mocks.getMerchantForApiRequest).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      { requestedMerchantId }
    );
    expect(query.range).toHaveBeenCalledWith(0, 99);
    expect(query.order).toHaveBeenNthCalledWith(1, 'stock', {
      ascending: true,
    });
    expect(query.order).toHaveBeenNthCalledWith(2, 'id', { ascending: true });
  });

  it('rejects an excessive page size before reading products', async () => {
    const from = vi.fn();
    mocks.createClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
        }),
      },
      from,
    });

    const response = await GET(
      new Request(
        'https://usebaci.com/api/inventory/forecast?limit=101'
      ) as never
    );

    expect(response.status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });
});
