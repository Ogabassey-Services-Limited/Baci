import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildGiglTrackingMerchantPushPayload } from './build-gigl-tracking-merchant-push-payload';
import {
  createGiglTrackingNotificationSupabase,
  giglTrackingNotificationTestNotification,
} from './gigl-tracking-notification-worker.test-support';

const notification = giglTrackingNotificationTestNotification;

describe('buildGiglTrackingMerchantPushPayload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps order-backed shipment_tracking payloads unchanged', async () => {
    const supabase = createGiglTrackingNotificationSupabase();
    const payload = await buildGiglTrackingMerchantPushPayload(
      supabase as never,
      notification
    );

    expect(payload).toEqual({
      orderId: notification.order_id,
      type: 'shipment_tracking',
    });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('bugfix: orderless merchant pushes include repairId with type repair', async () => {
    const repairId = '00000000-0000-4000-8000-000000000099';
    const supabase = createGiglTrackingNotificationSupabase({ id: repairId });
    const payload = await buildGiglTrackingMerchantPushPayload(
      supabase as never,
      { ...notification, order_id: null }
    );

    expect(supabase.from).toHaveBeenCalledWith('repairs');
    expect(payload).toEqual({ type: 'repair', repairId });
  });

  it('falls back to type repair with shipmentId when no repair is linked', async () => {
    const supabase = createGiglTrackingNotificationSupabase(null);
    const payload = await buildGiglTrackingMerchantPushPayload(
      supabase as never,
      { ...notification, order_id: null }
    );

    expect(payload).toEqual({
      type: 'repair',
      shipmentId: notification.shipment_id,
    });
  });
});
