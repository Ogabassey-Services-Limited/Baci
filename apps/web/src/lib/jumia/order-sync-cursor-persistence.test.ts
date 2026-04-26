import { beforeEach, describe, expect, it, vi } from 'vitest';
import { syncJumiaOrdersForActiveIntegrations } from '@/lib/jumia/order-sync';
import {
  createQuery,
  createSupabaseMock,
  getMockCallArg,
  item,
  order,
} from '@/lib/jumia/order-sync.test-helpers';
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

describe('Jumia order sync cursor persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('preserves full sync state when persisting the cursor initially fails', async () => {
    // Arrange
    const marketplaceQuery = createQuery(
      {
        data: [
          {
            id: 'integration-1',
            merchant_id: 'merchant-1',
            shop_id: 'shop-1',
            last_sync_at: '2026-04-25T07:00:00.000Z',
            sync_config: {
              orders: true,
              jumia_full_failure: {
                cursor: '2026-04-25T07:00:00.000Z',
                count: 2,
              },
            },
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
          baci_order_id: 'baci-order-1',
        },
      ],
      error: null,
    });
    const existingCanonicalQuery = createQuery({
      data: [
        {
          id: 'baci-order-1',
          external_id: order.id,
          tracking_token: 'tracking-token',
        },
      ],
      error: null,
    });
    const updateOrderQuery = createQuery({
      data: {
        id: 'baci-order-1',
        external_id: order.id,
        tracking_token: 'tracking-token',
      },
      error: null,
    });
    const cacheQuery = createQuery({ error: null }, { terminalUpsert: true });
    const failedCursorQuery = createQuery(
      { error: { message: 'cursor write denied' } },
      { terminalEqCall: 1 }
    );
    const retryCursorQuery = createQuery(
      { error: null },
      { terminalEqCall: 1 }
    );
    const supabase = createSupabaseMock(
      {
        marketplace_integrations: [
          marketplaceQuery,
          failedCursorQuery,
          retryCursorQuery,
        ],
        jumia_orders: [existingJumiaQuery, cacheQuery],
        orders: [existingCanonicalQuery, updateOrderQuery],
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

    // Act
    const result = await syncJumiaOrdersForActiveIntegrations(supabase);

    // Assert
    expect(result.synced).toBe(1);
    expect(result.errors).toEqual([
      'merchant-1: Failed to update Jumia sync cursor: cursor write denied',
    ]);
    const retryPayload = getMockCallArg<Record<string, unknown>>(
      retryCursorQuery.update,
      0,
      0
    );
    expect(retryPayload).toEqual(
      expect.objectContaining({
        last_sync_at: expect.any(String),
        sync_error: 'Failed to update Jumia sync cursor: cursor write denied',
        sync_config: { orders: true },
      })
    );
  });
});
