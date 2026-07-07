import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
  },
}));

import { logger } from '@/lib/logger';
import { getManualOrderNotificationOutboxTerminalState } from './order-notification-outbox-manual-state';

function createSupabaseMock(data: unknown, error: unknown = null) {
  return {
    rpc: vi.fn().mockResolvedValue({ data, error }),
  };
}

describe('getManualOrderNotificationOutboxTerminalState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns terminal when the outbox row was already sent', async () => {
    const supabase = createSupabaseMock('sent');

    const result = await getManualOrderNotificationOutboxTerminalState({
      eventType: 'order_shipped',
      merchantId: 'merchant-1',
      orderId: 'order-1',
      supabase,
    });

    expect(result).toEqual({ status: 'terminal', outboxStatus: 'sent' });
    expect(supabase.rpc).toHaveBeenCalledWith(
      'get_order_notification_outbox_manual_terminal_status',
      {
        p_event_type: 'order_shipped',
        p_merchant_id: 'merchant-1',
        p_order_id: 'order-1',
      }
    );
  });

  it('returns clear when no terminal outbox row exists', async () => {
    const result = await getManualOrderNotificationOutboxTerminalState({
      eventType: 'order_delivered',
      merchantId: 'merchant-1',
      orderId: 'order-1',
      supabase: createSupabaseMock(null),
    });

    expect(result).toEqual({ status: 'clear' });
  });

  it('returns error without throwing when the RPC fails', async () => {
    const result = await getManualOrderNotificationOutboxTerminalState({
      eventType: 'order_shipped',
      merchantId: 'merchant-1',
      orderId: 'order-1',
      supabase: createSupabaseMock(null, { message: 'rpc failed' }),
    });

    expect(result).toEqual({ status: 'error', error: 'rpc failed' });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          'Failed to read manual order notification outbox terminal state',
        orderId: 'order-1',
      })
    );
  });
});
