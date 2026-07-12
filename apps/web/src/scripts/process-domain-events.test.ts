import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  processDomainEventBatch,
  processDomainEventMessage,
} from './process-domain-events';

const validMessage = {
  enqueued_at: '2026-07-12T12:00:00.000Z',
  message: {
    data: {},
    domain_event_id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a234',
    event_name: 'catalog.product.updated.v1',
    idempotency_key: 'event-1',
    metadata: { environment: 'test' },
    occurred_at: '2026-07-12T12:00:00.000Z',
    producer: 'database',
    schema_version: 1,
    source: { operation: 'UPDATE', schema: 'public', table: 'products' },
    subject: { id: 'product-1', type: 'product' },
    trust_level: 'database',
  },
  msg_id: 1,
  read_ct: 1,
  visible_at: '2026-07-12T12:01:00.000Z',
};

afterEach(() => {
  delete process.env.EVENT_PIPELINE_ACTIVE_DESTINATIONS;
  delete process.env.EVENT_PIPELINE_CANARY_MERCHANT_IDS;
});

describe('processDomainEventMessage', () => {
  it('atomically archives a valid no-route observation', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });

    await processDomainEventMessage({ rpc } as never, validMessage, true);

    expect(rpc).toHaveBeenCalledWith('route_domain_event_v1', {
      p_active_destinations: [],
      p_destinations: [],
      p_domain_event_id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a234',
      p_queue_message_id: 1,
      p_shadow: true,
    });
  });

  it('activates only configured destinations for an allowlisted merchant', async () => {
    process.env.EVENT_PIPELINE_ACTIVE_DESTINATIONS = 'facebook,tiktok';
    process.env.EVENT_PIPELINE_CANARY_MERCHANT_IDS =
      '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a235';
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });

    await processDomainEventMessage(
      { rpc } as never,
      {
        ...validMessage,
        message: {
          ...validMessage.message,
          event_name: 'analytics.add_to_cart.v1',
          merchant_id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a235',
          producer: 'web',
          trust_level: 'tenant_verified_client',
        },
      },
      false
    );

    expect(rpc).toHaveBeenCalledWith(
      'route_domain_event_v1',
      expect.objectContaining({
        p_active_destinations: ['facebook', 'tiktok'],
        p_destinations: ['facebook', 'tiktok', 'snapchat'],
      })
    );
  });

  it('dead-letters a poison message without logging its payload', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await processDomainEventMessage(
        { rpc } as never,
        { ...validMessage, message: { password: 'do-not-copy' } },
        false
      );
    } finally {
      const logged = JSON.stringify(consoleError.mock.calls);
      expect(logged).not.toContain('do-not-copy');
      expect(logged).not.toContain('password');
      consoleError.mockRestore();
    }

    expect(rpc).toHaveBeenCalledWith(
      'dead_letter_ingress_event_v1',
      expect.objectContaining({
        p_failure_code: 'invalid_event_envelope',
        p_queue_message_id: 1,
      })
    );
  });

  it('honors a producer-level shadow-only gate in active routing mode', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });

    await processDomainEventMessage(
      {
        rpc,
      } as never,
      {
        ...validMessage,
        message: {
          ...validMessage.message,
          metadata: { environment: 'test', shadow_only: true },
        },
      },
      false
    );

    expect(rpc).toHaveBeenCalledWith(
      'route_domain_event_v1',
      expect.objectContaining({ p_shadow: true })
    );
  });

  it('dead-letters a repeatedly failing route instead of looping forever', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: { code: 'XX000' } })
      .mockResolvedValueOnce({ data: null, error: null });

    await processDomainEventMessage(
      { rpc } as never,
      { ...validMessage, read_ct: 5 },
      false,
      5
    );

    expect(rpc).toHaveBeenLastCalledWith(
      'dead_letter_ingress_event_v1',
      expect.objectContaining({
        p_failure_code: 'routing_attempts_exhausted',
        p_queue_message_id: 1,
      })
    );
  });

  it('continues after one message fails so the batch lease does not strand peers', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: { code: 'XX000' } })
      .mockResolvedValueOnce({ data: [], error: null });

    await expect(
      processDomainEventBatch(
        { rpc } as never,
        [validMessage, { ...validMessage, msg_id: 2 }],
        false
      )
    ).resolves.toEqual({ failed: 1, processed: 1 });

    expect(rpc).toHaveBeenCalledTimes(2);
  });
});
