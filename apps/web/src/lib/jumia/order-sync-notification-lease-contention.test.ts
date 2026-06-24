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

describe('Jumia order sync notification lease contention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parks the sync cursor when another worker holds the notification lease', async () => {
    const heldClaimQuery = createQuery({ data: null, error: null });
    const { syncCursorQuery, supabase } = createDuplicateNotificationSyncMock({
      markerQueries: [heldClaimQuery],
    });

    mocks.forIntegration.mockResolvedValue({ client: true });
    vi.mocked(getAllOrders).mockResolvedValue([order]);
    vi.mocked(getOrderItems).mockResolvedValue({
      orderId: order.id,
      orderNumber: order.number,
      items: [item],
    });

    const result = await syncJumiaOrdersForActiveIntegrations(supabase);

    expect(notifyMerchant).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        synced: 0,
        notified: 0,
        orderErrors: 1,
      })
    );
    expect(result.errors).toEqual([
      'merchant-1/jumia-order-1: Jumia order notification delivery is already leased by another sync worker',
    ]);
    const updatePayload = syncCursorQuery.update.mock.calls[0]?.[0] as
      | Record<string, unknown>
      | undefined;
    expect(updatePayload).toEqual(
      expect.objectContaining({
        last_sync_at: order.updatedAt,
        sync_error: expect.stringContaining('cursor parked'),
      })
    );
    expect(updatePayload?.sync_config).not.toHaveProperty('jumia_full_failure');
  });

  it('treats a claim miss as success when another worker already marked the notification sent', async () => {
    const heldClaimQuery = createQuery({ data: null, error: null });
    const alreadySentQuery = createQuery({
      data: { jumia_order_id: order.id },
      error: null,
    });
    const { syncCursorQuery, supabase } = createDuplicateNotificationSyncMock({
      markerQueries: [heldClaimQuery, alreadySentQuery],
    });

    mocks.forIntegration.mockResolvedValue({ client: true });
    vi.mocked(getAllOrders).mockResolvedValue([order]);
    vi.mocked(getOrderItems).mockResolvedValue({
      orderId: order.id,
      orderNumber: order.number,
      items: [item],
    });

    const result = await syncJumiaOrdersForActiveIntegrations(supabase);

    expect(notifyMerchant).not.toHaveBeenCalled();
    expect(alreadySentQuery.eq).toHaveBeenCalledWith('notification_sent', true);
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

  it('preserves sent notification state for duplicate pages after an already-sent claim miss', async () => {
    const heldClaimQuery = createQuery({ data: null, error: null });
    const alreadySentQuery = createQuery({
      data: { jumia_order_id: order.id },
      error: null,
    });
    const { duplicateCacheQuery, supabase } =
      createDuplicateNotificationSyncMock({
        markerQueries: [heldClaimQuery, alreadySentQuery],
      });

    mocks.forIntegration.mockResolvedValue({ client: true });
    vi.mocked(getAllOrders).mockResolvedValue([order, order]);
    vi.mocked(getOrderItems).mockResolvedValue({
      orderId: order.id,
      orderNumber: order.number,
      items: [item],
    });

    const result = await syncJumiaOrdersForActiveIntegrations(supabase);

    expect(notifyMerchant).not.toHaveBeenCalled();
    expect(alreadySentQuery.eq).toHaveBeenCalledWith('notification_sent', true);
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
        notified: 0,
        orderErrors: 0,
      })
    );
  });
});
