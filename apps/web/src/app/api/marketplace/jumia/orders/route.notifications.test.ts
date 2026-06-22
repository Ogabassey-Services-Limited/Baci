import { beforeEach, describe, expect, it } from 'vitest';
import { jumiaOrdersRouteHarness as harness } from './route.test-harness';

const { POST } = await import('./route');

describe('POST /api/marketplace/jumia/orders notification claims', () => {
  beforeEach(() => {
    harness.reset();
  });

  it('releases the notification claim when push delivery fails', async () => {
    harness.mocks.getAllOrders.mockResolvedValue([
      harness.createOrder('order-1'),
    ]);
    harness.mocks.notifyJumiaOrder.mockRejectedValueOnce(
      new Error('push unavailable')
    );

    const response = await POST(harness.createRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.newOrders).toBe(1);
    expect(harness.mocks.notifyJumiaOrder).toHaveBeenCalledTimes(1);
    expect(harness.mocks.mutations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          filters: expect.arrayContaining([
            ['jumia_order_id', 'order-1'],
            ['merchant_id', 'merchant-1'],
          ]),
          payload: { notification_sent: true },
          table: 'jumia_orders',
        }),
        expect.objectContaining({
          filters: expect.arrayContaining([
            ['jumia_order_id', 'order-1'],
            ['merchant_id', 'merchant-1'],
          ]),
          payload: { notification_sent: false },
          table: 'jumia_orders',
        }),
      ])
    );
    expect(harness.mocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Push notification failed for Jumia order',
        orderId: 'order-1',
      })
    );
  });
});
