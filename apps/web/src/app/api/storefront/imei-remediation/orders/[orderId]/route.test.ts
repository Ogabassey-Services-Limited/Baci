import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  enabled: true,
  rateLimit: vi.fn(),
  readOrders: vi.fn(),
  resolveCustomer: vi.fn(),
  resolveMerchant: vi.fn(),
}));

vi.mock('@/env', () => ({
  getRootDomain: () => 'usebaci.com',
  isPetrockRemediationEnabled: () => mocks.enabled,
}));
vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: mocks.authenticate,
}));
vi.mock('@/lib/imei-lookup-fulfillment', () => ({
  resolveImeiCustomer: mocks.resolveCustomer,
}));
vi.mock('@/lib/imei-remediation/petrock-remediation-customer-orders', () => ({
  readCustomerPetrockRemediationOrders: mocks.readOrders,
}));
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: mocks.rateLimit,
  createRateLimitResponse: () => Response.json({}, { status: 429 }),
}));
vi.mock('@/lib/storefront-merchant', () => ({
  resolveStorefrontMerchantFromRequest: mocks.resolveMerchant,
}));

import { GET } from './route';

const ORDER_ID = '11111111-1111-4111-8111-111111111111';
const request = new Request('https://ogabassey.usebaci.com/api/orders/status');
const context = (orderId = ORDER_ID) => ({
  params: Promise.resolve({ orderId }),
});

describe('GET /api/storefront/imei-remediation/orders/[orderId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enabled = true;
    mocks.authenticate.mockResolvedValue({
      supabase: {},
      user: { id: 'user-1' },
    });
    mocks.rateLimit.mockResolvedValue({
      allowed: true,
      limit: 30,
      remaining: 29,
      resetTime: Date.now() + 60_000,
    });
    mocks.resolveMerchant.mockResolvedValue({
      merchant: { id: 'merchant-1' },
      success: true,
    });
    mocks.resolveCustomer.mockResolvedValue({ id: 'customer-1' });
    mocks.readOrders.mockResolvedValue([
      { id: ORDER_ID, status: 'in_progress' },
    ]);
  });

  it('authenticates before rate limiting or reading status', async () => {
    mocks.authenticate.mockResolvedValue({ error: 'Unauthorized' });

    const response = await GET(request as never, context());

    expect(response.status).toBe(401);
    expect(mocks.rateLimit).not.toHaveBeenCalled();
    expect(mocks.readOrders).not.toHaveBeenCalled();
  });

  it('returns the column-safe customer order status', async () => {
    const response = await GET(request as never, context());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      order: { id: ORDER_ID, status: 'in_progress' },
      success: true,
    });
    expect(mocks.readOrders).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: ORDER_ID })
    );
  });

  it('does not reveal an unknown or malformed order id', async () => {
    const malformed = await GET(request as never, context('not-an-order'));
    expect(malformed.status).toBe(404);

    mocks.readOrders.mockResolvedValue([]);
    const missing = await GET(request as never, context());
    expect(missing.status).toBe(404);
  });
});
