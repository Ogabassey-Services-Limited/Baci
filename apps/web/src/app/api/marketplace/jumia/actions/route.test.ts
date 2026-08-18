import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  pack: vi.fn(),
  providers: vi.fn(),
  user: vi.fn(),
  client: vi.fn(),
}));
vi.mock('@/lib/jumia/fulfillment', () => ({
  packOrderV2: m.pack,
  readyToShip: vi.fn(),
  printLabels: vi.fn(),
  cancelItems: vi.fn(),
}));
vi.mock('@/lib/jumia/orders', () => ({
  getOrderItems: vi.fn(),
  getShipmentProviders: m.providers,
}));
vi.mock('@/lib/jumia/client', () => ({
  JumiaClient: { forIntegration: m.client },
}));
vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn(async () => ({ valid: true })),
}));
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => ({})) }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({ auth: { getUser: m.user }, from: vi.fn() })),
}));
vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: vi.fn(async () => ({ merchantId: 'M' })),
  toUserAccess: vi.fn(() => ({})),
}));
vi.mock('@/lib/api-auth', () => ({ hasPermission: vi.fn(() => true) }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }));
describe('Jumia actions pack validation', () => {
  it('rejects a pack before the pack call when tracking code is required', async () => {
    m.user.mockResolvedValue({ data: { user: { id: 'U' } } });
    m.client.mockResolvedValue({});
    m.providers.mockResolvedValue({
      orderItems: [
        {
          id: 'ITEM-1',
          shipmentProviders: [{ id: 'SP-1', trackingCodeRequired: true }],
        },
      ],
    });
    const { POST } = await import('./route');
    const response = await POST(
      new NextRequest('http://localhost', {
        method: 'POST',
        body: JSON.stringify({
          action: 'pack',
          integrationId: '00000000-0000-0000-0000-000000000001',
          orderId: 'ORDER-1',
          itemIds: ['ITEM-1'],
        }),
      })
    );
    expect(response.status).toBe(400);
    expect(m.pack).not.toHaveBeenCalled();
  });
});
