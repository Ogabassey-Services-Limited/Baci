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
  createQuery,
  createSupabaseMock,
  item,
  order,
} from './order-sync.test-helpers';
import {
  claimJumiaNotificationDelivery,
  getJumiaNotificationAttemptKey,
  isJumiaNotificationAlreadySent,
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

  it('claims rows where notification_sent is not true so legacy null markers are eligible', async () => {
    const claimQuery = createQuery({
      data: { jumia_order_id: 'jumia-order-1' },
      error: null,
    });
    const supabase = createSupabaseMock({ jumia_orders: [claimQuery] });

    await expect(
      claimJumiaNotificationDelivery(supabase, 'merchant-1', 'jumia-order-1')
    ).resolves.toEqual({
      claimed: true,
      claimedAt: expect.any(String),
      error: null,
    });
    expect(claimQuery.not).toHaveBeenCalledWith(
      'notification_sent',
      'is',
      true
    );
  });

  it('surfaces sent-state read errors instead of treating them as not sent', async () => {
    const readErrorQuery = createQuery({
      data: null,
      error: { message: 'read timeout' },
    });
    const supabase = createSupabaseMock({ jumia_orders: [readErrorQuery] });

    await expect(
      isJumiaNotificationAlreadySent(supabase, 'merchant-1', 'jumia-order-1')
    ).rejects.toEqual({ message: 'read timeout' });
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
    const syncCursorQuery = createQuery({ error: null }, { terminalEqCall: 2 });
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
    const cacheUpsertPayload = cacheQuery.upsert.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(cacheUpsertPayload).toEqual(
      expect.objectContaining({
        baci_order_id: 'baci-order-1',
      })
    );
    expect(cacheUpsertPayload).not.toHaveProperty('notification_sent');
    expect(cacheQuery.upsert).toHaveBeenCalledWith(expect.any(Object), {
      defaultToNull: false,
      onConflict: 'jumia_order_id',
    });
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
