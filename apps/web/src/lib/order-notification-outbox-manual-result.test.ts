import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
  },
}));

import { logger } from '@/lib/logger';
import { completeManualOrderNotificationOutboxEvent } from './order-notification-outbox-manual-result';

function createSupabaseMock() {
  return {
    rpc: vi.fn().mockResolvedValue({ data: 1, error: null }),
  };
}

describe('completeManualOrderNotificationOutboxEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks matching active outbox rows sent after a manual send succeeds', async () => {
    const supabase = createSupabaseMock();

    await completeManualOrderNotificationOutboxEvent({
      claimId: '10000000-0000-4000-8000-000000000001',
      eventType: 'order_shipped',
      merchantId: 'merchant-1',
      orderId: 'order-1',
      result: { status: 'sent', message: 'sent', messageId: 'msg-1' },
      supabase,
    });

    expect(supabase.rpc).toHaveBeenCalledWith(
      'complete_order_notification_outbox_manual_result',
      {
        p_event_type: 'order_shipped',
        p_merchant_id: 'merchant-1',
        p_message_id: 'msg-1',
        p_order_id: 'order-1',
        p_outbox_id: '10000000-0000-4000-8000-000000000001',
        p_skip_reason: null,
        p_status: 'sent',
      }
    );
  });

  it('marks matching active outbox rows skipped after a manual skip', async () => {
    const supabase = createSupabaseMock();

    await completeManualOrderNotificationOutboxEvent({
      claimId: '10000000-0000-4000-8000-000000000001',
      eventType: 'order_delivered',
      merchantId: 'merchant-1',
      orderId: 'order-1',
      result: { status: 'skipped', reason: 'missing_customer_email' },
      supabase,
    });

    expect(supabase.rpc).toHaveBeenCalledWith(
      'complete_order_notification_outbox_manual_result',
      {
        p_event_type: 'order_delivered',
        p_merchant_id: 'merchant-1',
        p_message_id: null,
        p_order_id: 'order-1',
        p_outbox_id: '10000000-0000-4000-8000-000000000001',
        p_skip_reason: 'missing_customer_email',
        p_status: 'skipped',
      }
    );
  });

  it('releases manual claims as retryable failed rows after known failures', async () => {
    const supabase = createSupabaseMock();

    await completeManualOrderNotificationOutboxEvent({
      claimId: '10000000-0000-4000-8000-000000000001',
      eventType: 'order_shipped',
      merchantId: 'merchant-1',
      orderId: 'order-1',
      result: { status: 'failed', error: 'provider unavailable' },
      supabase,
    });

    expect(supabase.rpc).toHaveBeenCalledWith(
      'complete_order_notification_outbox_manual_result',
      expect.objectContaining({
        p_skip_reason: 'provider unavailable',
        p_status: 'failed',
      })
    );
  });

  it('releases manual claims after invalid order state results', async () => {
    const supabase = createSupabaseMock();

    await completeManualOrderNotificationOutboxEvent({
      claimId: '10000000-0000-4000-8000-000000000001',
      eventType: 'order_shipped',
      merchantId: 'merchant-1',
      orderId: 'order-1',
      result: { status: 'invalid_state', error: 'Order must be shipped' },
      supabase,
    });

    expect(supabase.rpc).toHaveBeenCalledWith(
      'complete_order_notification_outbox_manual_result',
      expect.objectContaining({
        p_skip_reason: 'Order must be shipped',
        p_status: 'failed',
      })
    );
  });

  it('records unknown manual delivery outcomes as blocking skips', async () => {
    const supabase = createSupabaseMock();

    await completeManualOrderNotificationOutboxEvent({
      claimId: '10000000-0000-4000-8000-000000000001',
      eventType: 'order_shipped',
      merchantId: 'merchant-1',
      orderId: 'order-1',
      result: {
        status: 'failed',
        deliveryOutcome: 'unknown',
        error: 'request timed out',
      },
      supabase,
    });

    expect(supabase.rpc).toHaveBeenCalledWith(
      'complete_order_notification_outbox_manual_result',
      expect.objectContaining({
        p_skip_reason: 'delivery_outcome_unknown',
        p_status: 'skipped',
      })
    );
  });

  it('terminalizes a sent claim as outcome-unknown before propagating persistence failure', async () => {
    const supabase = createSupabaseMock();
    supabase.rpc
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'rpc failed' },
      })
      .mockResolvedValueOnce({ data: 1, error: null });

    await expect(
      completeManualOrderNotificationOutboxEvent({
        claimId: '10000000-0000-4000-8000-000000000001',
        eventType: 'order_shipped',
        merchantId: 'merchant-1',
        orderId: 'order-1',
        result: { status: 'sent', message: 'sent', messageId: 'msg-1' },
        supabase,
      })
    ).rejects.toThrow('Failed to persist manual order notification outcome');

    expect(supabase.rpc).toHaveBeenNthCalledWith(
      2,
      'complete_order_notification_outbox_manual_result',
      expect.objectContaining({
        p_message_id: 'msg-1',
        p_skip_reason: 'delivery_outcome_unknown',
        p_status: 'skipped',
      })
    );

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Failed to mark manual order notification outbox row complete',
        eventType: 'order_shipped',
        orderId: 'order-1',
      })
    );
  });

  it('also terminalizes a sent claim when the primary persistence request rejects', async () => {
    const supabase = createSupabaseMock();
    supabase.rpc
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce({ data: 1, error: null });

    await expect(
      completeManualOrderNotificationOutboxEvent({
        claimId: '10000000-0000-4000-8000-000000000001',
        eventType: 'order_delivered',
        merchantId: 'merchant-1',
        orderId: 'order-1',
        result: { status: 'sent', message: 'sent', messageId: 'msg-2' },
        supabase,
      })
    ).rejects.toThrow('Failed to persist manual order notification outcome');

    expect(supabase.rpc).toHaveBeenNthCalledWith(
      2,
      'complete_order_notification_outbox_manual_result',
      expect.objectContaining({
        p_message_id: 'msg-2',
        p_skip_reason: 'delivery_outcome_unknown',
        p_status: 'skipped',
      })
    );
  });

  it('treats a zero-row completion as a persistence failure', async () => {
    const supabase = createSupabaseMock();
    supabase.rpc.mockResolvedValueOnce({ data: 0, error: null });

    await expect(
      completeManualOrderNotificationOutboxEvent({
        claimId: '10000000-0000-4000-8000-000000000001',
        eventType: 'order_shipped',
        merchantId: 'merchant-1',
        orderId: 'order-1',
        result: { status: 'failed', error: 'provider unavailable' },
        supabase,
      })
    ).rejects.toThrow('Failed to persist manual order notification outcome');
  });
});
