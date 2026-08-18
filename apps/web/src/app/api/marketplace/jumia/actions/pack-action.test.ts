import { describe, expect, it, vi } from 'vitest';
import { executePackAction } from './pack-action';

vi.mock('@/lib/jumia/orders', () => ({
  getShipmentProviders: vi.fn(async () => ({
    orderItems: [
      {
        id: 'ITEM-1',
        shipmentProviders: [{ id: 'SP-1', trackingCodeRequired: true }],
      },
    ],
  })),
}));
vi.mock('@/lib/jumia/fulfillment', () => ({ packOrderV2: vi.fn() }));
describe('executePackAction', () => {
  it('rejects before pack when tracking code is required', async () => {
    const result = await executePackAction({
      client: {} as never,
      targetItemIds: ['ITEM-1'],
      isAllItems: false,
      orderId: 'ORDER-1',
      merchantId: 'MERCHANT-1',
      updateOrderStatus: vi.fn(),
    });
    expect(result).toEqual({
      error: 'trackingCode is required for the selected shipment provider',
    });
  });
});
