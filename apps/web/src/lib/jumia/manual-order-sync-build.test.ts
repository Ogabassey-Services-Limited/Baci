import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JumiaClient } from '@/lib/jumia/client';
import { getOrderItems } from '@/lib/jumia/orders';
import type { ManualJumiaOrder } from './manual-order-sync-types';

vi.mock('@/lib/jumia/orders', () => ({
  getOrderItems: vi.fn(),
}));

const loggerError = vi.fn();
vi.mock('@/lib/logger', () => ({
  logger: { error: (...args: unknown[]) => loggerError(...args) },
}));

import { buildJumiaOrderWrites } from './manual-order-sync-build';

function createOrder(
  overrides: Partial<ManualJumiaOrder> = {}
): ManualJumiaOrder {
  return {
    createdAt: '2026-06-22T12:00:00.000Z',
    id: 'order-1',
    number: 'NO-1',
    shippingAddress: {
      firstName: 'Ada<script>',
      lastName: 'Lovelace',
      phone: '+2348012345678',
      address: '<b>10 Jumia Road</b>',
    },
    status: 'pending',
    totalAmount: { currency: 'NGN', value: 12_000 },
    ...overrides,
  } as ManualJumiaOrder;
}

const client = { shopId: 'shop-1' } as unknown as JumiaClient;

describe('buildJumiaOrderWrites', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOrderItems).mockResolvedValue({
      items: [
        {
          id: 'item-1',
          product: {
            imageUrl: 'https://example.com/phone.jpg',
            name: '<b>Phone</b>',
            sellerSku: 'SKU-1',
          },
          status: 'pending',
          itemPrice: 12_000,
          paidPrice: 12_000,
        },
      ],
    } as Awaited<ReturnType<typeof getOrderItems>>);
  });

  it('deduplicates orders and builds sanitized upsert payloads with fetched items', async () => {
    const writes = await buildJumiaOrderWrites(
      client,
      'merchant-1',
      [createOrder(), createOrder()],
      new Map()
    );

    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({
      currency: 'NGN',
      isNewOrder: true,
      orderId: 'order-1',
      prefetchedNotificationSent: false,
      totalAmount: 12_000,
    });
    expect(writes[0]?.sanitizedCustomerName).not.toContain('<script>');
    expect(writes[0]?.upsertPayload).toMatchObject({
      customer_name: expect.not.stringContaining('<script>'),
      customer_phone: '+2348012345678',
      jumia_order_id: 'order-1',
      jumia_shop_id: 'shop-1',
      merchant_id: 'merchant-1',
    });
    expect(writes[0]?.upsertPayload.items).toEqual([
      expect.objectContaining({
        id: 'item-1',
        product: expect.objectContaining({
          name: expect.not.stringContaining('<b>'),
        }),
      }),
    ]);
    expect(getOrderItems).toHaveBeenCalledTimes(1);
  });

  it('continues without items when item lookup fails and preserves existing notification state', async () => {
    vi.mocked(getOrderItems).mockRejectedValueOnce(new Error('Jumia timeout'));

    const writes = await buildJumiaOrderWrites(
      client,
      'merchant-1',
      [createOrder()],
      new Map([
        [
          'order-1',
          {
            id: 'cache-row-1',
            jumia_order_id: 'order-1',
            notification_sent: true,
          },
        ],
      ])
    );

    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({
      existingOrderId: 'cache-row-1',
      isNewOrder: false,
      prefetchedNotificationSent: true,
    });
    expect(writes[0]?.upsertPayload).not.toHaveProperty('items');
    expect(loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Failed to fetch items for Jumia order',
        orderId: 'order-1',
      })
    );
  });
});
