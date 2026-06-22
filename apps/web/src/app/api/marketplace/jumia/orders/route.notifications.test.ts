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
          typeof mutation.payload.notification_claimed_at === 'string'
      )
    ).toBe(true);
    expect(
      harness.mocks.mutations.some(
        (mutation) =>
          mutation.table === 'jumia_orders' &&
          mutation.payload.notification_sent === true
      )
    ).toBe(false);
    const claimMutation = harness.mocks.mutations.find(
      (mutation) =>
        mutation.table === 'jumia_orders' &&
        typeof mutation.payload.notification_claimed_at === 'string'
    );
    const releaseMutation = harness.mocks.mutations.find(
      (mutation) =>
        mutation.table === 'jumia_orders' &&
        mutation.payload.notification_claimed_at === null
    );
    expect(releaseMutation?.filters).toContainEqual([
      'notification_claimed_at',
      claimMutation?.payload.notification_claimed_at,
    ]);
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
    const claimMutation = harness.mocks.mutations.find(
      (mutation) => typeof mutation.payload.notification_claimed_at === 'string'
    );
    expect(harness.mocks.mutations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          filters: expect.arrayContaining([
            ['merchant_id', 'merchant-1'],
            ['jumia_order_id', 'order-1'],
            ['notification_sent', false],
          ]),
          payload: { notification_claimed_at: expect.any(String) },
          table: 'jumia_orders',
        }),
        expect.objectContaining({
          filters: expect.arrayContaining([
            ['merchant_id', 'merchant-1'],
            ['jumia_order_id', 'order-1'],
            [
              'notification_claimed_at',
              claimMutation?.payload.notification_claimed_at,
            ],
          ]),
          payload: { notification_claimed_at: null, notification_sent: true },
          table: 'jumia_orders',
        }),
      ])
    );
  });

  it('does not mark notification_sent when no pushes are accepted', async () => {
    harness.mocks.getAllOrders.mockResolvedValue([
      harness.createOrder('order-1'),
    ]);
    harness.mocks.notifyJumiaOrder.mockResolvedValueOnce({
      errors: [{ message: 'no token' }],
      failed: 1,
      sent: 0,
    });

    const response = await POST(harness.createRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.newOrders).toBe(1);
    expect(
      harness.mocks.mutations.some(
        (mutation) => mutation.payload.notification_sent === true
      )
    ).toBe(false);
    const claimMutation = harness.mocks.mutations.find(
      (mutation) => typeof mutation.payload.notification_claimed_at === 'string'
    );
    const releaseMutation = harness.mocks.mutations.find(
      (mutation) => mutation.payload.notification_claimed_at === null
    );
    expect(releaseMutation?.filters).toContainEqual([
      'notification_claimed_at',
      claimMutation?.payload.notification_claimed_at,
    ]);
    expect(harness.mocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'No Jumia order push notifications were accepted',
        orderId: 'order-1',
      })
    );
  });

  it('skips delivery when another sync already holds the notification claim', async () => {
    harness.mocks.notificationClaimRows = [];
    harness.mocks.getAllOrders.mockResolvedValue([
      harness.createOrder('order-1'),
    ]);

    const response = await POST(harness.createRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.newOrders).toBe(1);
    expect(harness.mocks.notifyJumiaOrder).not.toHaveBeenCalled();
    expect(
      harness.mocks.mutations.some(
        (mutation) => mutation.payload.notification_sent === true
      )
    ).toBe(false);
  });
});
