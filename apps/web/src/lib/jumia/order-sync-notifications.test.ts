import { describe, expect, it, vi } from 'vitest';
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
      createQuery({ error: { message: 'still failing' } })
    );
    const supabase = createSupabaseMock({ jumia_orders: failedQueries });

    await expect(
      markJumiaNotificationSent(supabase, 'merchant-1', 'jumia-order-1', {
        attempts: 2,
        retryDelayMs: 0,
      })
    ).resolves.toEqual({ message: 'still failing' });
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

  it('skips duplicate Jumia notifications after a marker retry failure in one run', async () => {
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
          notification_sent: false,
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
    const updateOrderQuery = createQuery(
      { error: null },
      { terminalEqCall: 2 }
    );
    const cacheQuery = createQuery({ error: null }, { terminalUpsert: true });
    const duplicateCacheQuery = createQuery(
      { error: null },
      { terminalUpsert: true }
    );
    const failedNotificationQueries = Array.from({ length: 3 }, () =>
      createQuery({ error: { message: 'write timeout' } })
    );
    const syncCursorQuery = createQuery({ error: null }, { terminalEqCall: 1 });
    const supabase = createSupabaseMock(
      {
        marketplace_integrations: [marketplaceQuery, syncCursorQuery],
        jumia_orders: [
          existingJumiaQuery,
          cacheQuery,
          ...failedNotificationQueries,
          duplicateCacheQuery,
        ],
        orders: [existingCanonicalQuery, insertOrderQuery, updateOrderQuery],
      },
      {
        replace_order_items: [{ error: null }, { error: null }],
      }
    );

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
    for (const query of failedNotificationQueries) {
      expect(query.update).toHaveBeenCalledWith({ notification_sent: true });
    }
    expect(result).toEqual(
      expect.objectContaining({
        synced: 2,
        canonicalCreated: 1,
        canonicalUpdated: 1,
        notified: 1,
      })
    );
    expect(result.errors).toEqual([
      'merchant-1/jumia-order-1: Failed to mark Jumia notification as sent: write timeout',
    ]);
  });
});
