import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { notifyJumiaOrder } from '@/lib/expo-push';
import type { JumiaOrderWrite } from './manual-order-sync-types';
import {
  claimJumiaNotificationDelivery,
  isJumiaNotificationAlreadySent,
  markJumiaNotificationSent,
  releaseJumiaNotificationDeliveryClaim,
} from './order-sync-notifications';

vi.mock('@/lib/expo-push', () => ({
  notifyJumiaOrder: vi.fn(),
}));

const loggerError = vi.fn();
vi.mock('@/lib/logger', () => ({
  logger: { error: (...args: unknown[]) => loggerError(...args) },
}));

vi.mock('./order-sync-notifications', () => ({
  claimJumiaNotificationDelivery: vi.fn(),
  isJumiaNotificationAlreadySent: vi.fn(),
  markJumiaNotificationSent: vi.fn(),
  releaseJumiaNotificationDeliveryClaim: vi.fn(),
}));

import { sendManualJumiaNotifications } from './manual-order-sync-notifications';

function createWrite(
  overrides: Partial<JumiaOrderWrite> = {}
): JumiaOrderWrite {
  return {
    currency: 'NGN',
    existingOrderId: '',
    isNewOrder: true,
    orderId: 'order-1',
    orderNumber: 'NO-1',
    prefetchedNotificationSent: false,
    sanitizedCustomerName: 'Ada Lovelace',
    totalAmount: 12_000,
    upsertPayload: { jumia_order_id: 'order-1' },
    ...overrides,
  };
}

function createSupabaseWithNotificationRows(
  rows: Array<{ jumia_order_id: string; notification_sent: boolean }>
): SupabaseClient {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          in: vi.fn(() => Promise.resolve({ data: rows, error: null })),
        })),
      })),
    })),
  } as unknown as SupabaseClient;
}

describe('sendManualJumiaNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(claimJumiaNotificationDelivery).mockResolvedValue({
      claimed: true,
      claimedAt: '2026-06-22T12:00:00.000Z',
      error: null,
    });
    vi.mocked(isJumiaNotificationAlreadySent).mockResolvedValue(false);
    vi.mocked(markJumiaNotificationSent).mockResolvedValue(null);
    vi.mocked(releaseJumiaNotificationDeliveryClaim).mockResolvedValue(null);
    vi.mocked(notifyJumiaOrder).mockResolvedValue({
      sent: 1,
      failed: 0,
      errors: [],
    });
  });

  it('claims, sends, and marks new manual Jumia order notifications', async () => {
    const result = await sendManualJumiaNotifications(
      createSupabaseWithNotificationRows([]),
      'merchant-1',
      [createWrite()]
    );

    expect(result).toEqual({ markerFailed: false, newOrders: 1 });
    expect(notifyJumiaOrder).toHaveBeenCalledWith(
      'merchant-1',
      'NO-1',
      'Ada Lovelace',
      12_000,
      'NGN'
    );
    expect(markJumiaNotificationSent).toHaveBeenCalledWith(
      expect.anything(),
      'merchant-1',
      'order-1',
      { claimedAt: '2026-06-22T12:00:00.000Z' }
    );
  });

  it('fails closed on a claim miss unless another worker already marked sent', async () => {
    vi.mocked(claimJumiaNotificationDelivery).mockResolvedValueOnce({
      claimed: false,
      claimedAt: null,
      error: null,
    });
    vi.mocked(isJumiaNotificationAlreadySent).mockResolvedValueOnce(false);

    const result = await sendManualJumiaNotifications(
      createSupabaseWithNotificationRows([]),
      'merchant-1',
      [createWrite()]
    );

    expect(result).toEqual({ markerFailed: true, newOrders: 1 });
    expect(notifyJumiaOrder).not.toHaveBeenCalled();
    expect(loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Jumia order notification delivery is already leased',
        orderId: 'order-1',
      })
    );
  });

  it('releases the claim and fails closed when no push delivery is accepted', async () => {
    vi.mocked(notifyJumiaOrder).mockResolvedValueOnce({
      sent: 0,
      failed: 0,
      errors: [],
    });

    const result = await sendManualJumiaNotifications(
      createSupabaseWithNotificationRows([]),
      'merchant-1',
      [createWrite()]
    );

    expect(result).toEqual({ markerFailed: true, newOrders: 1 });
    expect(releaseJumiaNotificationDeliveryClaim).toHaveBeenCalledWith(
      expect.anything(),
      'merchant-1',
      'order-1',
      '2026-06-22T12:00:00.000Z'
    );
  });
});
