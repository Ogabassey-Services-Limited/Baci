import { describe, expect, it, vi } from 'vitest';
import type { JumiaClient } from '@/lib/jumia/client';
import {
  cancelItems,
  packOrderV2,
  printLabels,
  readyToShip,
} from '@/lib/jumia/fulfillment';

/** Minimal mock: only the `request` method is stubbed. */
function createMockClient(
  response: unknown,
  options?: { reject?: boolean }
): JumiaClient & { request: ReturnType<typeof vi.fn> } {
  const request = options?.reject
    ? vi.fn().mockRejectedValue(response)
    : vi.fn().mockResolvedValue(response);
  return { request } as JumiaClient & { request: ReturnType<typeof vi.fn> };
}

describe('packOrderV2', () => {
  it('calls POST /v2/orders/pack with packages body', async () => {
    const mockResponse = { message: 'success', orderItems: ['ITEM-1'] };
    const client = createMockClient(mockResponse);

    const packages = [
      {
        orderItems: 'ITEM-1',
        shipmentProviderId: 'SP-1',
        trackingCode: 'TRACK-001',
      },
    ];

    const result = await packOrderV2(client, packages);

    expect(client.request).toHaveBeenCalledWith(
      'POST',
      '/v2/orders/pack',
      expect.any(Object),
      { packages }
    );
    expect(result).toEqual(mockResponse);
  });

  it('propagates errors when client.request rejects', async () => {
    const client = createMockClient(new Error('Pack failed'), {
      reject: true,
    });

    await expect(
      packOrderV2(client, [
        {
          orderItems: 'ITEM-1',
          shipmentProviderId: 'SP-1',
          trackingCode: 'TRACK-001',
        },
      ])
    ).rejects.toThrow('Pack failed');
  });

  it('throws when packages array is empty', async () => {
    const client = createMockClient({});
    await expect(packOrderV2(client, [])).rejects.toThrow(
      'packOrderV2: packages must be a non-empty array'
    );
    expect(client.request).not.toHaveBeenCalled();
  });
});

describe('readyToShip', () => {
  it('calls POST /orders/ready-to-ship with orderItemIds', async () => {
    const mockResponse = { message: 'success' };
    const client = createMockClient(mockResponse);

    const result = await readyToShip(client, ['ITEM-1', 'ITEM-2']);

    expect(client.request).toHaveBeenCalledWith(
      'POST',
      '/orders/ready-to-ship',
      expect.any(Object),
      { orderItemIds: ['ITEM-1', 'ITEM-2'] }
    );
    expect(result).toEqual(mockResponse);
  });

  it('propagates errors when client.request rejects', async () => {
    const client = createMockClient(new Error('Ship failed'), {
      reject: true,
    });

    await expect(readyToShip(client, ['ITEM-1'])).rejects.toThrow(
      'Ship failed'
    );
  });

  it('throws when orderItemIds array is empty', async () => {
    const client = createMockClient({});
    await expect(readyToShip(client, [])).rejects.toThrow(
      'readyToShip: orderItemIds must be a non-empty array'
    );
    expect(client.request).not.toHaveBeenCalled();
  });
});

describe('cancelItems', () => {
  it('calls PUT /orders/cancel with orderItemIds', async () => {
    const mockResponse = { message: 'cancelled' };
    const client = createMockClient(mockResponse);

    const result = await cancelItems(client, ['ITEM-3']);

    expect(client.request).toHaveBeenCalledWith(
      'PUT',
      '/orders/cancel',
      expect.any(Object),
      { orderItemIds: ['ITEM-3'] }
    );
    expect(result).toEqual(mockResponse);
  });

  it('propagates errors when client.request rejects', async () => {
    const client = createMockClient(new Error('Cancel failed'), {
      reject: true,
    });

    await expect(cancelItems(client, ['ITEM-1'])).rejects.toThrow(
      'Cancel failed'
    );
  });

  it('throws when orderItemIds array is empty', async () => {
    const client = createMockClient({});
    await expect(cancelItems(client, [])).rejects.toThrow(
      'cancelItems: orderItemIds must be a non-empty array'
    );
    expect(client.request).not.toHaveBeenCalled();
  });
});

describe('printLabels', () => {
  it('calls POST /orders/print-labels with orderItemIds', async () => {
    const mockResponse = { url: 'https://labels.jumia.com/print/abc' };
    const client = createMockClient(mockResponse);

    const result = await printLabels(client, ['ITEM-1', 'ITEM-2']);

    expect(client.request).toHaveBeenCalledWith(
      'POST',
      '/orders/print-labels',
      expect.any(Object),
      { orderItemIds: ['ITEM-1', 'ITEM-2'] }
    );
    expect(result).toEqual(mockResponse);
  });

  it('propagates errors when client.request rejects', async () => {
    const client = createMockClient(new Error('Service unavailable'), {
      reject: true,
    });

    await expect(printLabels(client, ['ITEM-1'])).rejects.toThrow(
      'Service unavailable'
    );
  });

  it('throws when orderItemIds array is empty', async () => {
    const client = createMockClient({});
    await expect(printLabels(client, [])).rejects.toThrow(
      'printLabels: orderItemIds must be a non-empty array'
    );
    expect(client.request).not.toHaveBeenCalled();
  });
});
