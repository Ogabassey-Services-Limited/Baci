import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { notifyMerchant } from '@/lib/expo-push';
import { getAllOrders, getOrderItems } from '@/lib/jumia/orders';
import type { JumiaOrder, JumiaOrderItem } from '@/schemas/jumia';

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

import { syncJumiaOrdersForActiveIntegrations } from './order-sync';

interface QueryOptions {
  terminalEqCall?: number;
  terminalInsert?: boolean;
  terminalIn?: boolean;
  terminalUpsert?: boolean;
}

function createQuery(response: unknown, options: QueryOptions = {}) {
  let eqCalls = 0;
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => {
      eqCalls += 1;
      return options.terminalEqCall === eqCalls
        ? Promise.resolve(response)
        : query;
    }),
    in: vi.fn(() => (options.terminalIn ? Promise.resolve(response) : query)),
    insert: vi.fn(() =>
      options.terminalInsert ? Promise.resolve(response) : query
    ),
    update: vi.fn(() => query),
    upsert: vi.fn(() =>
      options.terminalUpsert ? Promise.resolve(response) : query
    ),
    delete: vi.fn(() => query),
    single: vi.fn(() => Promise.resolve(response)),
  };

  return query;
}

const order: JumiaOrder = {
  id: 'jumia-order-1',
  shopIds: ['shop-1'],
  totalItems: 1,
  packedItems: 0,
  isPrepayment: true,
  hasMultipleStatus: false,
  hasItemsFulfilledByJumia: false,
  pendingSince: '2026-04-25T08:00:00.000Z',
  status: 'ready_to_ship',
  deliveryOption: 'standard',
  number: '12345',
  totalAmount: { currency: 'NGN', value: 250000 },
  country: { code: 'NG', name: 'Nigeria', currencyCode: 'NGN' },
  shippingAddress: {
    firstName: 'Ada',
    lastName: 'Lovelace',
    address: '10 Jumia Road',
    city: 'Lagos',
    postalCode: '100001',
    ward: 'Ikeja',
    region: 'Lagos',
    countryName: 'Nigeria',
  },
  createdAt: '2026-04-25T08:01:00.000Z',
  updatedAt: '2026-04-25T08:02:00.000Z',
  totalAmountLocal: { currency: 'NGN', value: 250000 },
};

const item: JumiaOrderItem = {
  id: 'item-1',
  shopId: 'shop-1',
  product: {
    name: 'Samsung Phone',
    sellerSku: 'SKU-1',
    imageUrl: 'https://example.com/phone.jpg',
  },
  status: 'ready_to_ship',
  trackingNumber: '',
  trackingUrl: '',
  shipmentType: 'standard',
  deliveryOption: 'standard',
  isFulfilledByJumia: false,
  itemPrice: 250000,
  paidPrice: 245000,
  shippingAmount: 0,
  itemPriceLocal: 250000,
  paidPriceLocal: 245000,
  shippingAmountLocal: 0,
  exchangeRate: 1,
  country: { code: 'NG', name: 'Nigeria', currencyCode: 'NGN' },
  taxAmount: 0,
  voucherAmount: 5000,
  shippingAddress: order.shippingAddress,
};

function createSupabaseMock(tableQueries: Record<string, unknown[]>) {
  return {
    from: vi.fn((table: string) => {
      const query = tableQueries[table]?.shift();
      if (!query) throw new Error(`Unexpected table ${table}`);
      return query;
    }),
  } as unknown as SupabaseClient;
}

describe('syncJumiaOrdersForActiveIntegrations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an empty result when there are no active Jumia integrations', async () => {
    const marketplaceQuery = createQuery(
      { data: [], error: null },
      { terminalEqCall: 2 }
    );
    const supabase = createSupabaseMock({
      marketplace_integrations: [marketplaceQuery],
    });

    const result = await syncJumiaOrdersForActiveIntegrations(supabase);

    expect(result).toEqual({
      integrations: 0,
      synced: 0,
      canonicalCreated: 0,
      canonicalUpdated: 0,
      notified: 0,
      errors: [],
    });
    expect(mocks.forIntegration).not.toHaveBeenCalled();
  });

  it('notifies when an existing Jumia cache row was never linked to a Baci order', async () => {
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
    const existingJumiaQuery = createQuery(
      {
        data: [
          {
            jumia_order_id: order.id,
            notification_sent: false,
            baci_order_id: null,
          },
        ],
        error: null,
      },
      { terminalIn: true }
    );
    const existingCanonicalQuery = createQuery(
      { data: [], error: null },
      { terminalIn: true }
    );
    const insertOrderQuery = createQuery({
      data: {
        id: 'baci-order-1',
        external_id: order.id,
        tracking_token: 'tracking-token',
      },
      error: null,
    });
    const resetItemsQuery = createQuery({ error: null }, { terminalEqCall: 1 });
    const insertItemsQuery = createQuery(
      { error: null },
      { terminalInsert: true }
    );
    const cacheQuery = createQuery({ error: null }, { terminalUpsert: true });
    const notifyUpdateQuery = createQuery(
      { error: null },
      { terminalEqCall: 2 }
    );
    const syncCursorQuery = createQuery({ error: null }, { terminalEqCall: 1 });
    const supabase = createSupabaseMock({
      marketplace_integrations: [marketplaceQuery, syncCursorQuery],
      jumia_orders: [existingJumiaQuery, cacheQuery, notifyUpdateQuery],
      orders: [existingCanonicalQuery, insertOrderQuery],
      order_items: [resetItemsQuery, insertItemsQuery],
    });

    mocks.forIntegration.mockResolvedValue({ client: true });
    vi.mocked(getAllOrders).mockResolvedValue([order]);
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

    expect(result.notified).toBe(1);
    expect(result.canonicalCreated).toBe(1);
    expect(notifyMerchant).toHaveBeenCalledWith(
      'merchant-1',
      'Jumia Order',
      expect.stringContaining('Order #12345'),
      expect.objectContaining({
        order_id: 'baci-order-1',
        source: 'jumia',
        jumia_order_id: order.id,
      }),
      'orders'
    );
    expect(notifyUpdateQuery.update).toHaveBeenCalledWith({
      notification_sent: true,
    });
  });
});
