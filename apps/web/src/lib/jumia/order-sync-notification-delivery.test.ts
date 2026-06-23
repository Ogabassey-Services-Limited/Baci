import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JumiaOrder } from '@/schemas/jumia';
import {
  claimJumiaNotificationDelivery,
  isJumiaNotificationAlreadySent,
  markJumiaNotificationSent,
  releaseJumiaNotificationDeliveryClaim,
} from './order-sync-notifications';
import { notifySyncedJumiaOrder } from './order-sync-operations';

vi.mock('./order-sync-notifications', () => ({
  claimJumiaNotificationDelivery: vi.fn(),
  isJumiaNotificationAlreadySent: vi.fn(),
  markJumiaNotificationSent: vi.fn(),
  releaseJumiaNotificationDeliveryClaim: vi.fn(),
}));

vi.mock('./order-sync-operations', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('./order-sync-operations')>();
  return {
    ...original,
    notifySyncedJumiaOrder: vi.fn(),
  };
});

const loggerError = vi.fn();
const loggerWarn = vi.fn();
vi.mock('@/lib/logger', () => ({
  logger: {
    error: (...args: unknown[]) => loggerError(...args),
    warn: (...args: unknown[]) => loggerWarn(...args),
  },
}));

import { deliverSyncedJumiaOrderNotification } from './order-sync-notification-delivery';

const supabase = {} as SupabaseClient;
const order = {
  id: 'jumia-order-1',
  number: 'NO-1',
} as JumiaOrder;

function callDelivery() {
  return deliverSyncedJumiaOrderNotification({
    baciOrderId: 'baci-order-1',
    integrationId: 'integration-1',
    merchantId: 'merchant-1',
    order,
    supabase,
  });
}

describe('deliverSyncedJumiaOrderNotification', () => {
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
    vi.mocked(notifySyncedJumiaOrder).mockResolvedValue({
      sent: 1,
      failed: 0,
      errors: [],
    });
  });

  it('returns alreadySent when a claim miss observes a durable sent marker', async () => {
    vi.mocked(claimJumiaNotificationDelivery).mockResolvedValueOnce({
      claimed: false,
      claimedAt: null,
      error: null,
    });
    vi.mocked(isJumiaNotificationAlreadySent).mockResolvedValueOnce(true);

    await expect(callDelivery()).resolves.toEqual({
      alreadySent: true,
      sent: 0,
      failed: 0,
      errors: [],
    });

    expect(notifySyncedJumiaOrder).not.toHaveBeenCalled();
  });

  it('marks successful deliveries with the active claim timestamp', async () => {
    await expect(callDelivery()).resolves.toEqual({
      sent: 1,
      failed: 0,
      errors: [],
    });

    expect(markJumiaNotificationSent).toHaveBeenCalledWith(
      supabase,
      'merchant-1',
      'jumia-order-1',
      { claimedAt: '2026-06-22T12:00:00.000Z' }
    );
  });

  it('releases the claim and treats zero-token delivery as skipped', async () => {
    vi.mocked(notifySyncedJumiaOrder).mockResolvedValueOnce({
      sent: 0,
      failed: 0,
      errors: [],
    });

    await expect(callDelivery()).resolves.toEqual({
      sent: 0,
      failed: 0,
      errors: [],
    });
    expect(releaseJumiaNotificationDeliveryClaim).toHaveBeenCalledWith(
      supabase,
      'merchant-1',
      'jumia-order-1',
      '2026-06-22T12:00:00.000Z'
    );
  });

  it('surfaces release failures when zero-token delivery is skipped', async () => {
    vi.mocked(notifySyncedJumiaOrder).mockResolvedValueOnce({
      sent: 0,
      failed: 0,
      errors: [],
    });
    vi.mocked(releaseJumiaNotificationDeliveryClaim).mockResolvedValueOnce({
      message: 'release timeout',
    });

    await expect(callDelivery()).resolves.toEqual({
      sent: 0,
      failed: 0,
      errors: [],
      markerErrorMessage:
        'Failed to release Jumia notification delivery lease: release timeout',
    });
    expect(loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Failed to release Jumia notification delivery lease',
        jumiaOrderId: 'jumia-order-1',
      })
    );
  });

  it('releases the claim and returns failed push delivery details', async () => {
    vi.mocked(notifySyncedJumiaOrder).mockResolvedValueOnce({
      sent: 0,
      failed: 1,
      errors: ['Expo outage'],
    });

    await expect(callDelivery()).resolves.toEqual({
      sent: 0,
      failed: 1,
      errors: ['Expo outage'],
    });
    expect(releaseJumiaNotificationDeliveryClaim).toHaveBeenCalledWith(
      supabase,
      'merchant-1',
      'jumia-order-1',
      '2026-06-22T12:00:00.000Z'
    );
  });

  it('logs release failures before rethrowing push errors', async () => {
    vi.mocked(notifySyncedJumiaOrder).mockRejectedValueOnce(
      new Error('push failed')
    );
    vi.mocked(releaseJumiaNotificationDeliveryClaim).mockResolvedValueOnce({
      message: 'release timeout',
    });

    await expect(callDelivery()).rejects.toThrow('push failed');
    expect(loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Failed to release Jumia notification delivery lease',
        jumiaOrderId: 'jumia-order-1',
      })
    );
  });

  it('surfaces marker update failures without releasing an accepted delivery marker claim early', async () => {
    vi.mocked(markJumiaNotificationSent).mockResolvedValueOnce({
      message: 'write timeout',
    });

    await expect(callDelivery()).resolves.toEqual({
      sent: 1,
      failed: 0,
      errors: [],
      markerErrorMessage:
        'Failed to mark Jumia notification as sent: write timeout',
    });
    expect(releaseJumiaNotificationDeliveryClaim).not.toHaveBeenCalled();
  });
});
