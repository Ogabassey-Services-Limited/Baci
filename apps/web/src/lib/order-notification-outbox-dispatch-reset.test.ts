import { describe, expect, it, vi } from 'vitest';
import { resetOrderNotificationOutboxDispatch } from './order-notification-outbox-dispatch-reset';

const input = {
  claimId: '10000000-0000-4000-8000-000000000001',
  claimOwner: 'worker-1',
  eventType: 'order_shipped' as const,
  merchantId: 'merchant-1',
  orderId: 'order-1',
};

describe('resetOrderNotificationOutboxDispatch', () => {
  it('resets the exact active claim before a fallback transport send', async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: 1, error: null }),
    };

    await resetOrderNotificationOutboxDispatch({ ...input, supabase });

    expect(supabase.rpc).toHaveBeenCalledWith(
      'reset_order_notification_outbox_dispatch',
      {
        p_claim_owner: 'worker-1',
        p_event_type: 'order_shipped',
        p_merchant_id: 'merchant-1',
        p_order_id: 'order-1',
        p_outbox_id: '10000000-0000-4000-8000-000000000001',
      }
    );
  });

  it('fails closed when the claim is no longer active', async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: 0, error: null }),
    };

    await expect(
      resetOrderNotificationOutboxDispatch({ ...input, supabase })
    ).rejects.toThrow('Failed to reset order notification provider dispatch');
  });
});
