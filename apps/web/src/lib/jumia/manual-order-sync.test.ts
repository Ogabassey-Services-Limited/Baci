import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JumiaClient } from '@/lib/jumia/client';
import { getAllOrders } from '@/lib/jumia/orders';
import { buildJumiaOrderWrites } from './manual-order-sync-build';
import { sendManualJumiaNotifications } from './manual-order-sync-notifications';
import {
  loadManualExistingJumiaOrders,
  persistJumiaOrderWrites,
} from './manual-order-sync-persist';
import type { JumiaOrderWrite } from './manual-order-sync-types';

vi.mock('@/lib/jumia/orders', () => ({
  getAllOrders: vi.fn(),
}));

vi.mock('./manual-order-sync-build', () => ({
  buildJumiaOrderWrites: vi.fn(),
}));

vi.mock('./manual-order-sync-notifications', () => ({
  sendManualJumiaNotifications: vi.fn(),
}));

vi.mock('./manual-order-sync-persist', () => ({
  loadManualExistingJumiaOrders: vi.fn(),
  persistJumiaOrderWrites: vi.fn(),
}));

import { syncJumiaOrdersForManualIntegration } from './manual-order-sync';

const client = { shopId: 'shop-1' } as unknown as JumiaClient;
const supabase = {} as SupabaseClient;
const write = {
  currency: 'NGN',
  existingOrderId: '',
  isNewOrder: true,
  orderId: 'order-1',
  orderNumber: 'NO-1',
  prefetchedNotificationSent: false,
  sanitizedCustomerName: 'Ada Lovelace',
  totalAmount: 12_000,
  upsertPayload: { jumia_order_id: 'order-1' },
} satisfies JumiaOrderWrite;

describe('syncJumiaOrdersForManualIntegration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAllOrders).mockResolvedValue([
      { id: 'order-1', createdAt: '2026-06-22T12:00:00.000Z' },
    ] as Awaited<ReturnType<typeof getAllOrders>>);
    vi.mocked(loadManualExistingJumiaOrders).mockResolvedValue(new Map());
    vi.mocked(buildJumiaOrderWrites).mockResolvedValue([write]);
    vi.mocked(persistJumiaOrderWrites).mockResolvedValue({
      persistedOrderWrites: [write],
      upsertFailed: false,
    });
    vi.mocked(sendManualJumiaNotifications).mockResolvedValue({
      markerFailed: false,
      newOrders: 1,
    });
  });

  it('orchestrates manual order fetch, persist, and notification stages', async () => {
    const result = await syncJumiaOrdersForManualIntegration({
      jumiaClient: client,
      merchantId: 'merchant-1',
      supabase,
    });

    expect(result).toEqual({ newOrders: 1, success: true, synced: 1 });
    expect(loadManualExistingJumiaOrders).toHaveBeenCalledWith(
      supabase,
      'merchant-1',
      ['order-1']
    );
    expect(buildJumiaOrderWrites).toHaveBeenCalledWith(
      client,
      'merchant-1',
      expect.any(Array),
      expect.any(Map)
    );
    expect(sendManualJumiaNotifications).toHaveBeenCalledWith(
      supabase,
      'merchant-1',
      [write]
    );
  });

  it('returns failure when prefetching existing cache rows fails', async () => {
    vi.mocked(loadManualExistingJumiaOrders).mockResolvedValueOnce(null);

    await expect(
      syncJumiaOrdersForManualIntegration({
        jumiaClient: client,
        merchantId: 'merchant-1',
        supabase,
      })
    ).resolves.toEqual({ newOrders: 0, success: false, synced: 1 });

    expect(buildJumiaOrderWrites).not.toHaveBeenCalled();
  });
});
