import { describe, expect, it, vi } from 'vitest';
import { createEventPipelineServiceRoleTestClient } from '@/lib/events/event-pipeline-service-role-test-client';
import { domainEventWorkerBatch } from './domain-event-worker-batch';

const { processDomainEventBatch, processDomainEventMessage } = domainEventWorkerBatch;

type Rpc = (
  name: string,
  args: Record<string, unknown>
) => Promise<{ data: unknown; error: unknown }>;

function client(rpc: Rpc) {
  return createEventPipelineServiceRoleTestClient(
    vi.fn<typeof globalThis.fetch>(async (input, init) => {
      const result = await rpc(
        new URL(String(input)).pathname.split('/').at(-1) ?? '',
        JSON.parse(String(init?.body ?? '{}'))
      );
      return result.error
        ? Response.json(result.error, { status: 500 })
        : Response.json(result.data);
    })
  );
}

const validMessage = {
  enqueued_at: '2026-07-12T12:00:00.000Z',
  message: {
    data: {},
    domain_event_id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a234',
    event_name: 'catalog.product.updated.v1',
    idempotency_key: 'event-1',
    metadata: { environment: 'test' },
    occurred_at: '2026-07-12T12:00:00.000Z',
    producer: 'database' as const,
    schema_version: 1 as const,
    source: { operation: 'UPDATE', schema: 'public', table: 'products' },
    subject: { id: 'product-1', type: 'product' },
    trust_level: 'database' as const,
  },
  msg_id: 1,
  read_ct: 1,
  visible_at: '2026-07-12T12:01:00.000Z',
};

const routing = (
  routingMode: 'active' | 'disabled' | 'shadow' = 'active',
  cacheTransitionRoutingEnabled = false
) => ({
  cacheTransitionRoutingEnabled,
  routingMode,
  workerId: 'domain-event-router:test',
});

const cacheMessage = (overrides: Record<string, unknown> = {}) => ({
  ...validMessage,
  ...overrides,
  message: {
    ...validMessage.message,
    event_name: 'storefront.cache_transition.v1',
    subject: { id: 'category-1', type: 'category' },
    ...(overrides.message as Record<string, unknown> | undefined),
  },
});

describe('domain event worker cache routing', () => {
  it('routes an exact cache-transition event through its specialized RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });

    await processDomainEventMessage(
      client(rpc),
      cacheMessage({
        message: { domain_event_id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a238' },
      }),
      routing('active', true)
    );

    expect(rpc).toHaveBeenCalledWith(
      'route_storefront_cache_transition_v1',
      expect.objectContaining({
        p_domain_event_id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a238',
        p_queue_message_id: 1,
        p_worker_id: 'domain-event-router:test',
      })
    );
    expect(rpc).not.toHaveBeenCalledWith(
      'dead_letter_ingress_event_v1',
      expect.anything()
    );
  });

  it('reports a cache transition separately from generic processed work', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });

    await expect(
      processDomainEventBatch(client(rpc), [cacheMessage()], routing('active', true))
    ).resolves.toEqual({ cacheTransitions: 1, failed: 0, processed: 1 });
  });

  it('defers cache work without generic routing or dead-lettering on a stale router', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });

    await processDomainEventMessage(client(rpc), cacheMessage(), routing());

    expect(rpc).not.toHaveBeenCalled();
  });

  it('defers analytics records when only cache-transition routing is enabled', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });

    await processDomainEventMessage(client(rpc), validMessage, routing('disabled', true));

    expect(rpc).not.toHaveBeenCalled();
  });

  it('does not count a deferred cache record as processed', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });

    await expect(processDomainEventBatch(client(rpc), [cacheMessage()], routing())).resolves.toEqual({
      cacheTransitions: 0,
      failed: 0,
      processed: 0,
    });
  });

  it('defers a malformed cache-named envelope without generic dead-lettering', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const malformed = {
      ...validMessage,
      message: {
        event_name: 'storefront.cache_transition.v1',
        password: 'must-not-be-dead-lettered-generically',
      },
    };

    await expect(
      processDomainEventBatch(client(rpc), [malformed], routing('active', true))
    ).resolves.toEqual({ cacheTransitions: 0, failed: 0, processed: 0 });

    expect(rpc).not.toHaveBeenCalled();
  });

  it('retries specialized cache routing without generic dead-lettering and continues peers', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: { code: 'XX000' } })
      .mockResolvedValueOnce({ data: [], error: null });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await expect(
        processDomainEventBatch(
          client(rpc),
          [cacheMessage({ read_ct: 99 }), { ...validMessage, msg_id: 2 }],
          routing('active', true)
        )
      ).resolves.toEqual({ cacheTransitions: 0, failed: 1, processed: 1 });

      expect(rpc).toHaveBeenCalledWith(
        'route_storefront_cache_transition_v1',
        expect.anything()
      );
      expect(rpc).not.toHaveBeenCalledWith(
        'dead_letter_ingress_event_v1',
        expect.anything()
      );
    } finally {
      consoleError.mockRestore();
    }
  });
});
