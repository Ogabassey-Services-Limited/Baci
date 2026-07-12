import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
  },
}));

import { logger } from '@/lib/logger';
import { getManualOrderNotificationOutboxBlockingState } from './order-notification-outbox-manual-state';

function createSupabaseMock(data: unknown, error: unknown = null) {
  return {
    rpc: vi.fn().mockResolvedValue({ data, error }),
  };
}

describe('getManualOrderNotificationOutboxBlockingState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns blocked when the outbox row was already sent', async () => {
    const supabase = createSupabaseMock('sent');

    const result = await getManualOrderNotificationOutboxBlockingState({
      eventType: 'order_shipped',
      merchantId: 'merchant-1',
      orderId: 'order-1',
      supabase,
    });

    expect(result).toEqual({ status: 'blocked', outboxStatus: 'sent' });
    expect(supabase.rpc).toHaveBeenCalledWith(
      'prepare_order_notification_outbox_manual_send',
      {
        p_courier_name: null,
        p_estimated_delivery: null,
        p_event_type: 'order_shipped',
        p_merchant_id: 'merchant-1',
        p_order_id: 'order-1',
        p_tracking_number: null,
      }
    );
  });

  it('passes manual shipment details for pending outbox enrichment', async () => {
    const supabase = createSupabaseMock('pending');

    const result = await getManualOrderNotificationOutboxBlockingState({
      courierName: 'DHL',
      estimatedDelivery: '2026-07-15',
      eventType: 'order_shipped',
      merchantId: 'merchant-1',
      orderId: 'order-1',
      supabase,
      trackingNumber: 'TRACK-123',
    });

    expect(result).toEqual({ status: 'blocked', outboxStatus: 'pending' });
    expect(supabase.rpc).toHaveBeenCalledWith(
      'prepare_order_notification_outbox_manual_send',
      {
        p_courier_name: 'DHL',
        p_estimated_delivery: '2026-07-15',
        p_event_type: 'order_shipped',
        p_merchant_id: 'merchant-1',
        p_order_id: 'order-1',
        p_tracking_number: 'TRACK-123',
      }
    );
  });

  it('returns clear when no blocking outbox row exists', async () => {
    const result = await getManualOrderNotificationOutboxBlockingState({
      eventType: 'order_delivered',
      merchantId: 'merchant-1',
      orderId: 'order-1',
      supabase: createSupabaseMock(null),
    });

    expect(result).toEqual({ status: 'clear' });
  });

  it('blocks manual sends while a matching outbox row is pending', async () => {
    const result = await getManualOrderNotificationOutboxBlockingState({
      eventType: 'order_shipped',
      merchantId: 'merchant-1',
      orderId: 'order-1',
      supabase: createSupabaseMock('pending'),
    });

    expect(result).toEqual({ status: 'blocked', outboxStatus: 'pending' });
  });

  it('blocks manual sends while a matching outbox row is processing', async () => {
    const result = await getManualOrderNotificationOutboxBlockingState({
      eventType: 'order_delivered',
      merchantId: 'merchant-1',
      orderId: 'order-1',
      supabase: createSupabaseMock('processing'),
    });

    expect(result).toEqual({ status: 'blocked', outboxStatus: 'processing' });
  });

  it('allows manual retries after a skipped outbox row', async () => {
    const result = await getManualOrderNotificationOutboxBlockingState({
      eventType: 'order_delivered',
      merchantId: 'merchant-1',
      orderId: 'order-1',
      supabase: createSupabaseMock('skipped'),
    });

    expect(result).toEqual({ status: 'clear' });
  });

  it('allows manual retries after a failed outbox row', async () => {
    const result = await getManualOrderNotificationOutboxBlockingState({
      eventType: 'order_delivered',
      merchantId: 'merchant-1',
      orderId: 'order-1',
      supabase: createSupabaseMock('failed'),
    });

    expect(result).toEqual({ status: 'clear' });
  });

  it('returns error for an unrecognized outbox state', async () => {
    const result = await getManualOrderNotificationOutboxBlockingState({
      eventType: 'order_shipped',
      merchantId: 'merchant-1',
      orderId: 'order-1',
      supabase: createSupabaseMock('archived'),
    });

    expect(result).toEqual({
      status: 'error',
      error: 'unexpected_outbox_blocking_state',
    });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Unexpected manual order notification outbox blocking state',
        state: 'archived',
      })
    );
  });

  it('returns error without throwing when the RPC fails', async () => {
    const result = await getManualOrderNotificationOutboxBlockingState({
      eventType: 'order_shipped',
      merchantId: 'merchant-1',
      orderId: 'order-1',
      supabase: createSupabaseMock(null, { message: 'rpc failed' }),
    });

    expect(result).toEqual({ status: 'error', error: 'rpc failed' });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Failed to prepare manual order notification outbox state',
        orderId: 'order-1',
      })
    );
  });
});
