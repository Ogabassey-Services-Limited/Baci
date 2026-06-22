import { beforeEach, describe, expect, it } from 'vitest';
import { jumiaOrdersRouteHarness as harness } from './route.test-harness';

const { POST } = await import('./route');

describe('POST /api/marketplace/jumia/orders', () => {
  beforeEach(() => {
    harness.reset();
  });

  it('chunks existing-order prefetches, bulk upserts, and only counts duplicate Jumia IDs once', async () => {
    const uniqueOrders = Array.from({ length: 101 }, (_, index) =>
      harness.createOrder(`order-${index + 1}`)
    );
    harness.mocks.getAllOrders.mockResolvedValue([
      ...uniqueOrders,
      uniqueOrders[0],
    ]);

    const response = await POST(harness.createRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.newOrders).toBe(101);
    expect(body.synced).toBe(102);
    expect(harness.mocks.inQueries).toHaveLength(4);
    expect(harness.mocks.inQueries[0].values).toHaveLength(100);
    expect(harness.mocks.inQueries[1].values).toEqual(['order-101']);
    expect(harness.mocks.inQueries[2].values).toHaveLength(100);
    expect(harness.mocks.inQueries[3].values).toEqual(['order-101']);

    expect(harness.mocks.upserts).toHaveLength(2);
    expect(
      harness.mocks.upserts.every((upsert) =>
        Array.isArray(upsert.payload) ? upsert.payload.length <= 100 : true
      )
    ).toBe(true);
    const upsertRows = harness.mocks.upserts.flatMap((upsert) =>
      Array.isArray(upsert.payload) ? upsert.payload : [upsert.payload]
    );
    expect(upsertRows).toHaveLength(101);
    expect(upsertRows.map((row) => row.jumia_order_id)).toHaveLength(
      new Set(upsertRows.map((row) => row.jumia_order_id)).size
    );
    for (const upsert of harness.mocks.upserts) {
      harness.expectHomogeneousPayloadKeys(upsert.payload);
    }
    expect(harness.mocks.notifyJumiaOrder).toHaveBeenCalledTimes(101);
  });

  it('normalizes IDs to strings and updates existing orders without new notifications', async () => {
    harness.mocks.existingOrders.push({
      id: 'cache-row-123',
      jumia_order_id: '123',
      notification_sent: true,
    });
    harness.mocks.getAllOrders.mockResolvedValue([harness.createOrder(123)]);

    const response = await POST(harness.createRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.newOrders).toBe(0);
    expect(harness.mocks.notifyJumiaOrder).not.toHaveBeenCalled();

    const upsertRows = harness.getUpsertPayloadRows();
    expect(upsertRows).toHaveLength(1);
    expect(upsertRows[0]).toMatchObject({
      jumia_order_id: '123',
    });
    expect(upsertRows[0]).not.toHaveProperty('notification_sent');
    expect(harness.mocks.upserts[0]?.options).toEqual({
      defaultToNull: false,
      onConflict: 'jumia_order_id',
    });
    expect(
      harness.mocks.mutations.some(
        (mutation) => mutation.table === 'jumia_orders'
      )
    ).toBe(false);
  });

  it('does not restore stale notification markers from the prefetch snapshot', async () => {
    harness.mocks.existingOrders.push({
      id: 'cache-row-order-1',
      jumia_order_id: 'order-1',
      notification_sent: false,
    });
    harness.mocks.notificationStates = [
      {
        id: 'cache-row-order-1',
        jumia_order_id: 'order-1',
        notification_sent: true,
      },
    ];
    harness.mocks.getAllOrders.mockResolvedValue([
      harness.createOrder('order-1'),
    ]);

    const response = await POST(harness.createRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.newOrders).toBe(0);
    const upsertRows = harness.getUpsertPayloadRows();
    expect(upsertRows).toHaveLength(1);
    expect(upsertRows[0]).not.toHaveProperty('notification_sent');
    expect(harness.mocks.notifyJumiaOrder).not.toHaveBeenCalled();
  });

  it('retries existing Jumia orders whose current notification marker is still unset', async () => {
    harness.mocks.existingOrders.push({
      id: 'cache-row-order-1',
      jumia_order_id: 'order-1',
      notification_sent: false,
    });
    harness.mocks.notificationStates = [
      {
        id: 'cache-row-order-1',
        jumia_order_id: 'order-1',
        notification_sent: false,
      },
    ];
    harness.mocks.getAllOrders.mockResolvedValue([
      harness.createOrder('order-1'),
    ]);

    const response = await POST(harness.createRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.newOrders).toBe(0);
    expect(harness.mocks.notifyJumiaOrder).toHaveBeenCalledTimes(1);
    expect(harness.mocks.notifyJumiaOrder).toHaveBeenCalledWith(
      'merchant-1',
      'NO-order-1',
      'Ada Lovelace',
      12_000,
      'NGN'
    );
    expect(
      harness.mocks.mutations.some((mutation) =>
        mutation.filters.some(
          ([column, value]) =>
            column === 'jumia_order_id' && value === 'order-1'
        )
      )
    ).toBe(true);
  });

  it('fails closed when existing-order prefetch fails', async () => {
    harness.mocks.prefetchError = { message: 'select failed' };
    harness.mocks.getAllOrders.mockResolvedValue([
      harness.createOrder('order-1'),
    ]);

    const response = await POST(harness.createRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Failed to process orders' });
    expect(harness.mocks.upserts).toHaveLength(0);
    expect(harness.mocks.notifyJumiaOrder).not.toHaveBeenCalled();
    expect(harness.mocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Failed to prefetch existing Jumia orders',
      })
    );
  });
});
