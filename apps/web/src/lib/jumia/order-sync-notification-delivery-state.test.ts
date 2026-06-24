import { beforeEach, describe, expect, it, vi } from 'vitest';
import { notifyMerchant } from '@/lib/expo-push';
import { getAllOrders, getOrderItems } from '@/lib/jumia/orders';

const mocks = vi.hoisted(() => ({
  forIntegration: vi.fn(),
}));

vi.mock('@/lib/jumia/client', () => ({
  JumiaClient: {
    forIntegration: mocks.forIntegration,
  },
}));

vi.mock('@/lib/jumia/orders', () => ({
  getAllOrders: vi.fn(),
  getOrderItems: vi.fn(),
}));

vi.mock('@/lib/expo-push', () => ({
  notifyMerchant: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

import { syncJumiaOrdersForActiveIntegrations } from './order-sync';
import {
  createDuplicateNotificationSyncMock,
  createQuery,
  item,
  order,
} from './order-sync.test-helpers';

describe('Jumia order sync notification delivery state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('advances the sync cursor when no merchant push recipients exist', async () => {
    const notificationClaimQuery = createQuery({
      data: { jumia_order_id: order.id },
      error: null,
    });
    const releaseClaimQuery = createQuery({
      data: { jumia_order_id: order.id },
      error: null,
    });
    const { syncCursorQuery, supabase } = createDuplicateNotificationSyncMock({
      markerQueries: [notificationClaimQuery, releaseClaimQuery],
    });

    mocks.forIntegration.mockResolvedValue({ client: true });
    vi.mocked(getAllOrders).mockResolvedValue([order]);
    vi.mocked(getOrderItems).mockResolvedValue({
      orderId: order.id,
      orderNumber: order.number,
      items: [item],
    });
    vi.mocked(notifyMerchant).mockResolvedValue({
      sent: 0,
      failed: 0,
      errors: [],
    });

    const result = await syncJumiaOrdersForActiveIntegrations(supabase);

    expect(releaseClaimQuery.update).toHaveBeenCalledWith({
      notification_claimed_at: null,
    });
    expect(result).toEqual(
      expect.objectContaining({
        synced: 1,
        notified: 0,
        orderErrors: 0,
      })
    );
    expect(result.errors).toEqual([]);
    const updatePayload = syncCursorQuery.update.mock.calls[0]?.[0] as
      | Record<string, unknown>
      | undefined;
    expect(updatePayload).toEqual(
      expect.objectContaining({
        last_sync_at: expect.any(String),
        sync_error: null,
      })
    );
  });

  it('skips duplicate Jumia notifications after a marker retry failure in one run', async () => {
    const notificationClaimQuery = createQuery({
      data: { jumia_order_id: order.id },
      error: null,
    });
    const failedNotificationQueries = Array.from({ length: 3 }, () =>
      createQuery({ error: { message: 'write timeout' } })
    );
    const { duplicateCacheQuery, supabase } =
      createDuplicateNotificationSyncMock({
        jumiaOrder: order,
        markerQueries: [notificationClaimQuery, ...failedNotificationQueries],
      });

    mocks.forIntegration.mockResolvedValue({ client: true });
    vi.mocked(getAllOrders).mockResolvedValue([order, order]);
    vi.mocked(getOrderItems).mockResolvedValue({
      orderId: order.id,
      orderNumber: order.number,
      items: [item],
    });
    vi.mocked(notifyMerchant).mockResolvedValue({
      sent: 1,
      failed: 0,
      errors: [],
    });

    const result = await syncJumiaOrdersForActiveIntegrations(supabase);

    expect(notifyMerchant).toHaveBeenCalledTimes(1);
    expect(notificationClaimQuery.update).toHaveBeenCalledWith({
      notification_claimed_at: expect.any(String),
    });
    for (const query of failedNotificationQueries) {
      expect(query.update).toHaveBeenCalledWith({
        notification_claimed_at: null,
        notification_sent: true,
      });
    }
    expect(result).toEqual(
      expect.objectContaining({
        synced: 1,
        canonicalCreated: 1,
        canonicalUpdated: 1,
        notified: 1,
        orderErrors: 1,
      })
    );
    const duplicateUpsertPayload = duplicateCacheQuery.upsert.mock
      .calls[0]?.[0] as Record<string, unknown>;
    expect(duplicateUpsertPayload).toEqual(
      expect.objectContaining({
        baci_order_id: 'baci-order-1',
      })
    );
    expect(duplicateUpsertPayload).not.toHaveProperty('notification_sent');
    expect(duplicateCacheQuery.upsert).toHaveBeenCalledWith(
      expect.any(Object),
      { defaultToNull: false, onConflict: 'jumia_order_id' }
    );
    expect(result.errors).toEqual([
      'merchant-1/jumia-order-1: Failed to mark Jumia notification as sent: write timeout',
    ]);
  });

  it('preserves notification state for duplicate Jumia pages after marker success', async () => {
    const notificationClaimQuery = createQuery({
      data: { jumia_order_id: order.id },
      error: null,
    });
    const notifyUpdateQuery = createQuery({
      data: { jumia_order_id: order.id },
      error: null,
    });
    const { duplicateCacheQuery, supabase } =
      createDuplicateNotificationSyncMock({
        jumiaOrder: order,
        markerQueries: [notificationClaimQuery, notifyUpdateQuery],
      });

    mocks.forIntegration.mockResolvedValue({ client: true });
    vi.mocked(getAllOrders).mockResolvedValue([order, order]);
    vi.mocked(getOrderItems).mockResolvedValue({
      orderId: order.id,
      orderNumber: order.number,
      items: [item],
    });
    vi.mocked(notifyMerchant).mockResolvedValue({
      sent: 1,
      failed: 0,
      errors: [],
    });

    const result = await syncJumiaOrdersForActiveIntegrations(supabase);

    expect(notifyMerchant).toHaveBeenCalledTimes(1);
    expect(notificationClaimQuery.update).toHaveBeenCalledWith({
      notification_claimed_at: expect.any(String),
    });
    const duplicateUpsertPayload = duplicateCacheQuery.upsert.mock
      .calls[0]?.[0] as Record<string, unknown>;
    expect(duplicateUpsertPayload).toEqual(
      expect.objectContaining({
        baci_order_id: 'baci-order-1',
      })
    );
    expect(duplicateUpsertPayload).not.toHaveProperty('notification_sent');
    expect(duplicateCacheQuery.upsert).toHaveBeenCalledWith(
      expect.any(Object),
      { defaultToNull: false, onConflict: 'jumia_order_id' }
    );
    expect(result).toEqual(
      expect.objectContaining({
        synced: 2,
        canonicalCreated: 1,
        canonicalUpdated: 1,
        notified: 1,
        orderErrors: 0,
      })
    );
  });
});
