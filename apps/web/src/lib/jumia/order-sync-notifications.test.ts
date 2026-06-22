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
  createSupabaseMock,
  item,
  order,
} from './order-sync.test-helpers';
import {
  getJumiaNotificationAttemptKey,
  markJumiaNotificationSent,
} from './order-sync-notifications';

describe('Jumia order sync notification markers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds a stable notification attempt key', () => {
    expect(getJumiaNotificationAttemptKey('merchant:1', 'order/1')).toBe(
      'merchant%3A1:order%2F1'
    );
  });

  it('retries notification_sent updates and scopes them to the merchant', async () => {
    const failedQuery = createQuery({ error: { message: 'write timeout' } });
    const successQuery = createQuery({
      data: { jumia_order_id: 'jumia-order-1' },
      error: null,
    });
    const supabase = createSupabaseMock({
      jumia_orders: [failedQuery, successQuery],
    });

    await expect(
      markJumiaNotificationSent(supabase, 'merchant-1', 'jumia-order-1', {
        retryDelayMs: 0,
      })
    ).resolves.toBe(null);
    expect(failedQuery.eq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
    expect(successQuery.eq).toHaveBeenCalledWith(
      'jumia_order_id',
      'jumia-order-1'
    );
  });

  it('returns the last marker error when all retries fail', async () => {
    const failedQueries = Array.from({ length: 2 }, () =>
      createQuery({ error: { code: '08006', message: 'still failing' } })
    );
    const supabase = createSupabaseMock({ jumia_orders: failedQueries });

    await expect(
      markJumiaNotificationSent(supabase, 'merchant-1', 'jumia-order-1', {
        attempts: 2,
        retryDelayMs: 0,
      })
    ).resolves.toEqual({ code: '08006', message: 'still failing' });
  });

  it('does not retry permanent notification marker errors', async () => {
    const failedQuery = createQuery({
      error: { code: '42501', message: 'permission denied' },
    });
    const supabase = createSupabaseMock({ jumia_orders: [failedQuery] });

    await expect(
      markJumiaNotificationSent(supabase, 'merchant-1', 'jumia-order-1', {
        attempts: 3,
        retryDelayMs: 0,
      })
    ).resolves.toEqual({ code: '42501', message: 'permission denied' });
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it('treats an already-sent claimed marker retry as success', async () => {
    const emptyClaimScopedUpdate = createQuery({ data: null, error: null });
    const alreadySentQuery = createQuery({
      data: { jumia_order_id: 'jumia-order-1' },
      error: null,
    });
    const supabase = createSupabaseMock({
      jumia_orders: [emptyClaimScopedUpdate, alreadySentQuery],
    });

    await expect(
      markJumiaNotificationSent(supabase, 'merchant-1', 'jumia-order-1', {
        attempts: 1,
        claimedAt: '2026-06-22T18:00:00.000Z',
        retryDelayMs: 0,
      })
    ).resolves.toBe(null);
    expect(alreadySentQuery.eq).toHaveBeenCalledWith('notification_sent', true);
  });

  it('returns an explicit error when no Jumia row is updated', async () => {
    const emptyQuery = createQuery({ data: null, error: null });
    const supabase = createSupabaseMock({ jumia_orders: [emptyQuery] });

    await expect(
      markJumiaNotificationSent(supabase, 'merchant-1', 'jumia-order-1', {
        attempts: 1,
        retryDelayMs: 0,
      })
    ).resolves.toEqual({
      message: 'No Jumia order notification marker updated for jumia-order-1',
    });
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
    expect(duplicateCacheQuery.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        notification_sent: true,
        baci_order_id: 'baci-order-1',
      }),
      { onConflict: 'jumia_order_id' }
    );
    expect(result).toEqual(
      expect.objectContaining({
        synced: 2,
        notified: 0,
        orderErrors: 0,
      })
    );
  });

  it('parks the sync cursor when no merchant push delivery is accepted', async () => {
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
        synced: 0,
        notified: 0,
        orderErrors: 1,
      })
    );
    expect(result.errors).toEqual([
      'merchant-1/jumia-order-1: No merchant push notification delivery was accepted for the Jumia order',
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
    expect(duplicateCacheQuery.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        notification_sent: true,
        baci_order_id: 'baci-order-1',
      }),
      { onConflict: 'jumia_order_id' }
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
    expect(duplicateCacheQuery.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        notification_sent: true,
        baci_order_id: 'baci-order-1',
      }),
      { onConflict: 'jumia_order_id' }
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

  it('does not re-notify legacy cache rows already marked as notified', async () => {
    const marketplaceQuery = createQuery(
      {
        data: [
          {
            id: 'integration-1',
            merchant_id: 'merchant-1',
            shop_id: 'shop-1',
            last_sync_at: '2026-04-25T07:00:00.000Z',
            sync_config: { orders: true },
          },
        ],
        error: null,
      },
      { terminalEqCall: 2 }
    );
    const existingJumiaQuery = createQuery({
      data: [
        {
          jumia_order_id: order.id,
          notification_sent: true,
          baci_order_id: null,
        },
      ],
      error: null,
    });
    const existingCanonicalQuery = createQuery({ data: [], error: null });
    const insertOrderQuery = createQuery({
      data: {
        id: 'baci-order-1',
        external_id: order.id,
        tracking_token: 'tracking-token',
      },
      error: null,
    });
    const cacheQuery = createQuery({ error: null }, { terminalUpsert: true });
    const syncCursorQuery = createQuery({ error: null }, { terminalEqCall: 1 });
    const supabase = createSupabaseMock(
      {
        marketplace_integrations: [marketplaceQuery, syncCursorQuery],
        jumia_orders: [existingJumiaQuery, cacheQuery],
        orders: [existingCanonicalQuery, insertOrderQuery],
      },
      {
        replace_order_items: [{ error: null }],
      }
    );

    mocks.forIntegration.mockResolvedValue({ client: true });
    vi.mocked(getAllOrders).mockResolvedValue([order]);
    vi.mocked(getOrderItems).mockResolvedValue({
      orderId: order.id,
      orderNumber: order.number,
      items: [item],
    });

    const result = await syncJumiaOrdersForActiveIntegrations(supabase);

    expect(notifyMerchant).not.toHaveBeenCalled();
    expect(cacheQuery.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        notification_sent: true,
        baci_order_id: 'baci-order-1',
      }),
      { onConflict: 'jumia_order_id' }
    );
    expect(result).toEqual(
      expect.objectContaining({
        synced: 1,
        canonicalCreated: 1,
        notified: 0,
        orderErrors: 0,
      })
    );
  });
});
