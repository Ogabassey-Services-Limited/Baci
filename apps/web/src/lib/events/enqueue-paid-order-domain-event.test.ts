import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { enqueuePaidOrderDomainEvent } from './enqueue-paid-order-domain-event';

describe('enqueuePaidOrderDomainEvent', () => {
  it('uses the order side-effect identity as the producer dedupe key', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          already_enqueued: false,
          domain_event_id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a234',
          queue_message_id: 12,
        },
      ],
      error: null,
    });

    const supabase: Pick<SupabaseClient, 'rpc'> = { rpc } as Pick<
      SupabaseClient,
      'rpc'
    >;

    await enqueuePaidOrderDomainEvent(supabase, {
      externalEventId: 'purchase_order-1',
      merchantId: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a235',
      occurredAt: '2026-07-13T12:34:56.000Z',
      orderId: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a236',
    });

    expect(rpc).toHaveBeenCalledWith(
      'enqueue_domain_event_v1',
      expect.objectContaining({
        p_event_name: 'analytics.purchase.completed.v1',
        p_idempotency_key:
          'paid-order-ad-tracking:019bbd89-8f5f-7f8c-a4fd-42b5d7e7a236',
        p_occurred_at: '2026-07-13T12:34:56.000Z',
        p_trust_level: 'server',
      })
    );
  });

  it('rejects when the enqueue RPC fails', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'database unavailable' },
    });
    const supabase: Pick<SupabaseClient, 'rpc'> = { rpc } as Pick<
      SupabaseClient,
      'rpc'
    >;

    await expect(
      enqueuePaidOrderDomainEvent(supabase, {
        externalEventId: 'purchase_order-1',
        merchantId: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a235',
        orderId: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a236',
      })
    ).rejects.toThrow('paid_order_event_enqueue_failed');
  });
});
