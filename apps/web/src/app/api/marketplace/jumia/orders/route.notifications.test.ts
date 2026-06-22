import { beforeEach, describe, expect, it } from 'vitest';
import { jumiaOrdersRouteHarness as harness } from './route.test-harness';

const { POST } = await import('./route');

describe('POST /api/marketplace/jumia/orders notification markers', () => {
  beforeEach(() => {
    harness.reset();
  });

  it('does not mark notification_sent when push delivery fails', async () => {
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
    expect(
      harness.mocks.mutations.some(
        (mutation) =>
          mutation.table === 'jumia_orders' &&
          mutation.payload.notification_sent === true
      )
    ).toBe(false);
    expect(harness.mocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Push notification failed for Jumia order',
        orderId: 'order-1',
      })
    );
  });

  it('marks notification_sent after push delivery succeeds', async () => {
    harness.mocks.getAllOrders.mockResolvedValue([
      harness.createOrder('order-1'),
    ]);

    const response = await POST(harness.createRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.newOrders).toBe(1);
    expect(harness.mocks.notifyJumiaOrder).toHaveBeenCalledTimes(1);
    expect(harness.mocks.mutations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          filters: expect.arrayContaining([
            ['merchant_id', 'merchant-1'],
            ['jumia_order_id', 'order-1'],
          ]),
          payload: { notification_sent: true },
          table: 'jumia_orders',
        }),
      ])
    );
  });
});
