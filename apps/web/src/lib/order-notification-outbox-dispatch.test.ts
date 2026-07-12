import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
  },
}));

import { logger } from '@/lib/logger';
import { beginOrderNotificationOutboxDispatch } from './order-notification-outbox-dispatch';

const input = {
  claimId: '10000000-0000-4000-8000-000000000001',
  eventType: 'order_shipped' as const,
  merchantId: 'merchant-1',
  orderId: 'order-1',
};

describe('beginOrderNotificationOutboxDispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks the exact claimed row before provider dispatch', async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: 1, error: null }),
    };

    await beginOrderNotificationOutboxDispatch({ ...input, supabase });

    expect(supabase.rpc).toHaveBeenCalledWith(
      'begin_order_notification_outbox_dispatch',
      {
        p_event_type: 'order_shipped',
        p_merchant_id: 'merchant-1',
        p_order_id: 'order-1',
        p_outbox_id: '10000000-0000-4000-8000-000000000001',
      }
    );
  });

  it.each([
    ['database errors', { data: null, error: { message: 'rpc failed' } }],
    ['lost claims', { data: 0, error: null }],
  ])('fails closed for %s', async (_label, result) => {
    const supabase = { rpc: vi.fn().mockResolvedValue(result) };

    await expect(
      beginOrderNotificationOutboxDispatch({ ...input, supabase })
    ).rejects.toThrow('Failed to begin order notification provider dispatch');

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Failed to begin order notification provider dispatch',
        outboxId: input.claimId,
      })
    );
  });

  it('fails closed when the RPC rejects', async () => {
    const supabase = {
      rpc: vi.fn().mockRejectedValue(new Error('network unavailable')),
    };

    await expect(
      beginOrderNotificationOutboxDispatch({ ...input, supabase })
    ).rejects.toThrow('Failed to begin order notification provider dispatch');
  });
});
