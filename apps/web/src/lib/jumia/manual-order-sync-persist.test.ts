import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JumiaOrderWrite } from './manual-order-sync-types';

const loggerError = vi.fn();
vi.mock('@/lib/logger', () => ({
  logger: { error: (...args: unknown[]) => loggerError(...args) },
}));

import {
  loadManualExistingJumiaOrders,
  persistJumiaOrderWrites,
} from './manual-order-sync-persist';

function createSelectClient(response: unknown): SupabaseClient {
  const inMock = vi.fn(() => Promise.resolve(response));
  const eqMock = vi.fn(() => ({ in: inMock }));
  const selectMock = vi.fn(() => ({ eq: eqMock }));

  return {
    from: vi.fn(() => ({ select: selectMock })),
  } as unknown as SupabaseClient;
}

function createPersistClient(
  results: Array<{ error: { message: string } | null }>
) {
  const upsert = vi.fn(() =>
    Promise.resolve(results.shift() ?? { error: null })
  );
  const client = {
    from: vi.fn(() => ({ upsert })),
  } as unknown as SupabaseClient;
  return { client, upsert };
}

function createWrite(
  orderId: string,
  payload: Record<string, unknown>
): JumiaOrderWrite {
  return {
    currency: 'NGN',
    existingOrderId: '',
    isNewOrder: true,
    orderId,
    orderNumber: `NO-${orderId}`,
    prefetchedNotificationSent: false,
    sanitizedCustomerName: 'Ada Lovelace',
    totalAmount: 12_000,
    upsertPayload: payload,
  };
}

describe('manual order sync persistence helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads existing Jumia orders into a notification-aware lookup map', async () => {
    const supabase = createSelectClient({
      data: [
        { id: 'row-1', jumia_order_id: 123, notification_sent: true },
        { id: 'row-2', jumia_order_id: '456', notification_sent: null },
      ],
      error: null,
    });

    const lookup = await loadManualExistingJumiaOrders(supabase, 'merchant-1', [
      '123',
      '456',
    ]);

    expect(lookup?.get('123')).toEqual({
      id: 'row-1',
      jumia_order_id: '123',
      notification_sent: true,
    });
    expect(lookup?.get('456')?.notification_sent).toBe(false);
  });

  it('falls back to row upserts when a bulk upsert chunk fails', async () => {
    const bulkError = { message: 'payload too large' };
    const rowError = { message: 'row failed' };
    const { client, upsert } = createPersistClient([
      { error: bulkError },
      { error: null },
      { error: rowError },
    ]);
    const writeA = createWrite('order-1', {
      jumia_order_id: 'order-1',
      status: 'pending',
    });
    const writeB = createWrite('order-2', {
      jumia_order_id: 'order-2',
      status: 'pending',
    });

    const result = await persistJumiaOrderWrites(client, [writeA, writeB]);

    expect(upsert).toHaveBeenCalledTimes(3);
    expect(result).toEqual({
      persistedOrderWrites: [writeA],
      upsertFailed: true,
    });
    expect(loggerError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Failed to bulk upsert Jumia orders' })
    );
    expect(loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Failed to upsert individual Jumia order',
        orderId: 'order-2',
      })
    );
  });
});
