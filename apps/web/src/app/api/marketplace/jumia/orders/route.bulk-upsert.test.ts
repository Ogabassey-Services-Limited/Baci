import { beforeEach, describe, expect, it } from 'vitest';
import { jumiaOrdersRouteHarness as harness } from './route.test-harness';

const { POST } = await import('./route');

describe('POST /api/marketplace/jumia/orders bulk upserts', () => {
  beforeEach(() => {
    harness.reset();
  });

  it('splits bulk upserts by payload shape when some order-item fetches fail', async () => {
    harness.mocks.getAllOrders.mockResolvedValue([
      harness.createOrder('order-1'),
      harness.createOrder('order-2'),
    ]);
    harness.mocks.getOrderItems
      .mockRejectedValueOnce(new Error('items unavailable'))
      .mockResolvedValueOnce({ items: [] });

    const response = await POST(harness.createRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.newOrders).toBe(2);
    expect(harness.mocks.upserts).toHaveLength(2);
    for (const upsert of harness.mocks.upserts) {
      harness.expectHomogeneousPayloadKeys(upsert.payload);
      expect(upsert.options).toEqual({
        defaultToNull: false,
        onConflict: 'jumia_order_id',
      });
    }
    const upsertPayloads = harness.mocks.upserts.flatMap((upsert) =>
      Array.isArray(upsert.payload) ? upsert.payload : [upsert.payload]
    );
    expect(upsertPayloads).toHaveLength(2);
    expect(upsertPayloads.some((payload) => 'items' in payload)).toBe(true);
    expect(upsertPayloads.some((payload) => !('items' in payload))).toBe(true);
  });

  it('falls back to individual upserts and notifies rows when a bulk group fails', async () => {
    harness.mocks.getAllOrders.mockResolvedValue([
      harness.createOrder('order-1'),
      harness.createOrder('order-2'),
    ]);
    harness.mocks.getOrderItems
      .mockRejectedValueOnce(new Error('items unavailable'))
      .mockResolvedValueOnce({ items: [] });
    harness.mocks.upsertErrors.push(null, { message: 'second group failed' });

    const response = await POST(harness.createRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.newOrders).toBe(2);
    expect(harness.mocks.upserts).toHaveLength(3);
    expect(harness.mocks.notifyJumiaOrder).toHaveBeenCalledTimes(2);
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
    expect(harness.mocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Failed to bulk upsert Jumia orders',
        persistedOrderCount: 1,
      })
    );
  });

  it('notifies valid rows before returning a failed individual row fallback', async () => {
    harness.mocks.getAllOrders.mockResolvedValue([
      harness.createOrder('order-1'),
      harness.createOrder('order-2'),
    ]);
    harness.mocks.upsertErrors.push({ message: 'bulk group failed' }, null, {
      message: 'row failed',
    });

    const response = await POST(harness.createRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Failed to process orders' });
    expect(harness.mocks.upserts).toHaveLength(3);
    expect(harness.mocks.notifyJumiaOrder).toHaveBeenCalledTimes(1);
    expect(harness.mocks.notifyJumiaOrder).toHaveBeenCalledWith(
      'merchant-1',
      'NO-order-1',
      'Ada Lovelace',
      12_000,
      'NGN'
    );
    expect(harness.mocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Failed to upsert individual Jumia order',
        orderId: 'order-2',
      })
    );
  });

  it('fails closed when the first bulk upsert and row fallback fail before notifications', async () => {
    harness.mocks.upsertError = { message: 'upsert failed' };
    harness.mocks.getAllOrders.mockResolvedValue([
      harness.createOrder('order-1'),
    ]);

    const response = await POST(harness.createRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Failed to process orders' });
    expect(harness.mocks.upserts).toHaveLength(2);
    expect(harness.mocks.notifyJumiaOrder).not.toHaveBeenCalled();
    expect(harness.mocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Failed to bulk upsert Jumia orders',
        orderCount: 1,
      })
    );
  });
});
