import { beforeEach, describe, expect, it, vi } from 'vitest';
import { processClaimedGiglTrackingNotifications } from './gigl-tracking-notification-worker';

const notifyMerchant = vi.hoisted(() => vi.fn());
const notifyCustomer = vi.hoisted(() => vi.fn());
vi.mock('@/lib/expo-push', () => ({ notifyCustomer, notifyMerchant }));

const notification = {
  audience: 'merchant' as const,
  id: '00000000-0000-4000-8000-000000000001',
  merchant_id: '00000000-0000-4000-8000-000000000002',
  notification_kind: 'pickup_en_route',
  order_id: '00000000-0000-4000-8000-000000000003',
  tracking_event_id: '00000000-0000-4000-8000-000000000004',
};

function query(data: unknown, selections: string[] = []) {
  const builder = {
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
    select: vi.fn((columns: string) => {
      selections.push(columns);
      return builder;
    }),
  };
  return builder;
}

function supabaseFor(...rows: unknown[]) {
  const selections: string[] = [];
  const from = vi
    .fn()
    .mockImplementation(() => query(rows.shift() ?? null, selections));
  const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
  return { from, rpc, selections };
}

describe('processClaimedGiglTrackingNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notifyMerchant.mockResolvedValue({ errors: [], failed: 0, sent: 1 });
    notifyCustomer.mockResolvedValue({ errors: [], failed: 0, sent: 1 });
  });
  it('notifies the merchant and completes the claimed event', async () => {
    const supabase = supabaseFor({
      description: 'Rider assigned',
      raw_status: 'RIDER EN ROUTE FOR PICKUP',
    });
    const summary = await processClaimedGiglTrackingNotifications(
      supabase as never,
      [notification],
      'worker'
    );

    expect(summary).toEqual({
      claimed: 1,
      failed: 0,
      sent: 1,
      skipped: 0,
      success: true,
    });
    expect(supabase.selections[0]).toBe('description');
    expect(notifyMerchant).toHaveBeenCalledWith(
      notification.merchant_id,
      'Rider en route',
      expect.any(String),
      expect.any(Object),
      'orders',
      {
        onDeliveryStart: expect.any(Function),
        requiredShipmentUpdateCapability: 1,
      }
    );
    expect(supabase.rpc).toHaveBeenCalledWith(
      'complete_shipment_tracking_notification',
      expect.objectContaining({ p_outcome: 'sent' })
    );
  });

  it('notifies the order customer using merchant-scoped storefront tokens', async () => {
    const supabase = supabaseFor(
      { description: 'Delivered', raw_status: 'DELIVERED' },
      { customer_id: '00000000-0000-4000-8000-000000000005' },
      { user_id: '00000000-0000-4000-8000-000000000006' }
    );
    const summary = await processClaimedGiglTrackingNotifications(
      supabase as never,
      [
        {
          ...notification,
          audience: 'customer',
          notification_kind: 'delivered',
        },
      ],
      'worker'
    );

    expect(summary.sent).toBe(1);
    expect(notifyCustomer).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000006',
      'Order delivered',
      expect.any(String),
      expect.any(Object),
      'orders',
      expect.objectContaining({
        merchantId: notification.merchant_id,
        requiredShipmentUpdateCapability: 1,
      })
    );
  });

  it('skips customer notifications when the order has no customer identity', async () => {
    const supabase = supabaseFor(
      { description: 'Delivered', raw_status: 'DELIVERED' },
      { customer_id: null }
    );
    const summary = await processClaimedGiglTrackingNotifications(
      supabase as never,
      [{ ...notification, audience: 'customer' }],
      'worker'
    );

    expect(summary.skipped).toBe(1);
    expect(notifyCustomer).not.toHaveBeenCalled();
  });

  it('retries a transient customer lookup failure before dispatch begins', async () => {
    const supabase = supabaseFor({
      description: 'Delivered',
      raw_status: 'DELIVERED',
    });
    const failingOrderQuery = query(null);
    failingOrderQuery.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'database unavailable' },
    });
    supabase.from.mockReturnValueOnce(
      query({
        description: 'Delivered',
        raw_status: 'DELIVERED',
      })
    );
    supabase.from.mockReturnValueOnce(failingOrderQuery);

    const summary = await processClaimedGiglTrackingNotifications(
      supabase as never,
      [{ ...notification, audience: 'customer' }],
      'worker'
    );

    expect(summary.failed).toBe(1);
    expect(notifyCustomer).not.toHaveBeenCalled();
    expect(supabase.rpc).not.toHaveBeenCalledWith(
      'begin_shipment_tracking_notification_dispatch',
      expect.anything()
    );
    expect(supabase.rpc).toHaveBeenCalledWith(
      'complete_shipment_tracking_notification',
      expect.objectContaining({ p_outcome: 'failed' })
    );
  });

  it('does not replay devices that accepted a partially successful push', async () => {
    notifyMerchant.mockResolvedValue({
      errors: ['DeviceNotRegistered (1 failed): stale token'],
      failed: 1,
      sent: 1,
    });
    const supabase = supabaseFor({
      description: 'Rider assigned',
      raw_status: 'RIDER EN ROUTE FOR PICKUP',
    });

    const summary = await processClaimedGiglTrackingNotifications(
      supabase as never,
      [notification],
      'worker'
    );

    expect(summary.sent).toBe(1);
    expect(summary.failed).toBe(0);
    expect(supabase.rpc).toHaveBeenCalledWith(
      'complete_shipment_tracking_notification',
      expect.objectContaining({ p_outcome: 'sent' })
    );
  });

  it('skips a notification when its audience has no active push token', async () => {
    notifyMerchant.mockResolvedValue({ errors: [], failed: 0, sent: 0 });
    const supabase = supabaseFor({
      description: 'Rider assigned',
      raw_status: 'RIDER EN ROUTE FOR PICKUP',
    });

    const summary = await processClaimedGiglTrackingNotifications(
      supabase as never,
      [notification],
      'worker'
    );

    expect(summary).toMatchObject({ failed: 0, sent: 0, skipped: 1 });
    expect(supabase.rpc).toHaveBeenCalledWith(
      'complete_shipment_tracking_notification',
      expect.objectContaining({
        p_error: 'no_active_push_token',
        p_outcome: 'skipped',
      })
    );
  });

  it('retries a token lookup error without marking dispatch as started', async () => {
    notifyMerchant.mockResolvedValue({
      errors: ['push token lookup failed'],
      failed: 0,
      sent: 0,
    });
    const supabase = supabaseFor({
      description: 'Rider assigned',
      raw_status: 'RIDER EN ROUTE FOR PICKUP',
    });

    const summary = await processClaimedGiglTrackingNotifications(
      supabase as never,
      [notification],
      'worker'
    );

    expect(summary.failed).toBe(1);
    expect(supabase.rpc).not.toHaveBeenCalledWith(
      'begin_shipment_tracking_notification_dispatch',
      expect.anything()
    );
  });

  it('marks dispatch only through the provider delivery-start callback', async () => {
    const supabase = supabaseFor({
      description: 'Rider assigned',
      raw_status: 'RIDER EN ROUTE FOR PICKUP',
    });
    notifyMerchant.mockImplementation(
      async (_merchantId, _title, _body, _payload, _channel, options) => {
        await options?.onDeliveryStart?.();
        return { errors: [], failed: 0, sent: 1 };
      }
    );

    await processClaimedGiglTrackingNotifications(
      supabase as never,
      [notification],
      'worker'
    );

    expect(supabase.rpc).toHaveBeenCalledWith(
      'begin_shipment_tracking_notification_dispatch',
      expect.objectContaining({ p_id: notification.id, p_worker_id: 'worker' })
    );
  });

  it('lets completion retry after the provider explicitly rejects every push', async () => {
    const supabase = supabaseFor({
      description: 'Rider assigned',
      raw_status: 'RIDER EN ROUTE FOR PICKUP',
    });
    notifyMerchant.mockImplementation(
      async (_merchantId, _title, _body, _payload, _channel, options) => {
        await options?.onDeliveryStart?.();
        return {
          errors: ['InvalidCredentials (1 failed): invalid token'],
          failed: 1,
          sent: 0,
        };
      }
    );

    await processClaimedGiglTrackingNotifications(
      supabase as never,
      [notification],
      'worker'
    );

    expect(supabase.rpc).not.toHaveBeenCalledWith(
      'reset_shipment_tracking_notification_dispatch',
      expect.anything()
    );
    expect(supabase.rpc).toHaveBeenCalledWith(
      'complete_shipment_tracking_notification',
      expect.objectContaining({ p_outcome: 'failed' })
    );
  });
});
