import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
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

const activeDestinationsKey = 'EVENT_PIPELINE_ACTIVE_DESTINATIONS';
const canaryMerchantsKey = 'EVENT_PIPELINE_CANARY_MERCHANT_IDS';
let activeDestinationsBeforeTest: string | undefined;
let canaryMerchantsBeforeTest: string | undefined;

beforeEach(() => {
  activeDestinationsBeforeTest = process.env[activeDestinationsKey];
  canaryMerchantsBeforeTest = process.env[canaryMerchantsKey];
});

afterEach(() => {
  if (activeDestinationsBeforeTest === undefined) {
    delete process.env[activeDestinationsKey];
  } else {
    process.env[activeDestinationsKey] = activeDestinationsBeforeTest;
  }
  if (canaryMerchantsBeforeTest === undefined) {
    delete process.env[canaryMerchantsKey];
  } else {
    process.env[canaryMerchantsKey] = canaryMerchantsBeforeTest;
  }
});

describe('domain event worker batch', () => {
  it('atomically archives a valid no-route observation', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    await processDomainEventMessage(client(rpc), validMessage, routing('shadow'));

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
      client(rpc),
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
      routing()
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
        client(rpc),
        { ...validMessage, message: { password: 'do-not-copy' } },
        routing()
      );
    } finally {
      expect(JSON.stringify(consoleError.mock.calls)).not.toContain('password');
      consoleError.mockRestore();
    }
    expect(rpc).toHaveBeenCalledWith(
      'dead_letter_ingress_event_v1',
      expect.objectContaining({ p_failure_code: 'invalid_event_envelope' })
    );
  });

  it('honors a producer-level shadow-only gate in active routing mode', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });

    await processDomainEventMessage(
      client(rpc),
      {
        ...validMessage,
        message: {
          ...validMessage.message,
          metadata: { environment: 'test', shadow_only: true },
        },
      },
      routing()
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
      client(rpc),
      { ...validMessage, read_ct: 5 },
      routing(),
      5
    );
    expect(rpc).toHaveBeenLastCalledWith(
      'dead_letter_ingress_event_v1',
      expect.objectContaining({ p_failure_code: 'routing_attempts_exhausted' })
    );
  });

  it('continues after one failure so the batch lease does not strand peers', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: { code: 'XX000' } })
      .mockResolvedValueOnce({ data: [], error: null });
    await expect(
      processDomainEventBatch(
        client(rpc),
        [validMessage, { ...validMessage, msg_id: 2 }],
        routing()
      )
    ).resolves.toEqual({ cacheTransitions: 0, failed: 1, processed: 1 });
  });

  it('logs only safe message identity when one batch item fails', async () => {
    const sensitiveValue = 'private-token-do-not-log';
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: 'XX000',
        details: `database details ${sensitiveValue}`,
        message: `database message ${sensitiveValue}`,
      },
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const result = await processDomainEventBatch(
        client(rpc),
        [
          {
            ...validMessage,
            message: {
              ...validMessage.message,
              data: { secret: sensitiveValue },
            },
          },
        ],
        routing()
      );

      expect(result).toEqual({ cacheTransitions: 0, failed: 1, processed: 0 });
      expect(consoleError).toHaveBeenCalledOnce();
      expect(consoleError).toHaveBeenCalledWith(
        JSON.stringify({
          code: 'domain_event_route_failed',
          msg_id: 1,
          worker: 'domain-event-router',
        })
      );
      expect(JSON.stringify(consoleError.mock.calls)).not.toContain(sensitiveValue);
    } finally {
      consoleError.mockRestore();
    }
  });

  it('checks the stop signal before every message', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    const shouldStop = vi
      .fn()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    await expect(
      processDomainEventBatch(
        client(rpc),
        [validMessage, { ...validMessage, msg_id: 2 }],
        routing(),
        shouldStop
      )
    ).resolves.toEqual({ cacheTransitions: 0, failed: 0, processed: 1 });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  describe('environment isolation', () => {
    const activeDestinationsBeforeSuite =
      process.env[activeDestinationsKey];
    const canaryMerchantsBeforeSuite = process.env[canaryMerchantsKey];
    const preexistingActiveDestinations = 'snapchat';
    const preexistingCanaryMerchant =
      '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a236';

    beforeAll(() => {
      process.env[activeDestinationsKey] = preexistingActiveDestinations;
      process.env[canaryMerchantsKey] = preexistingCanaryMerchant;
    });

    afterAll(() => {
      try {
        expect(process.env[activeDestinationsKey]).toBe(
          preexistingActiveDestinations
        );
        expect(process.env[canaryMerchantsKey]).toBe(
          preexistingCanaryMerchant
        );
      } finally {
        if (activeDestinationsBeforeSuite === undefined) {
          delete process.env[activeDestinationsKey];
        } else {
          process.env[activeDestinationsKey] = activeDestinationsBeforeSuite;
        }
        if (canaryMerchantsBeforeSuite === undefined) {
          delete process.env[canaryMerchantsKey];
        } else {
          process.env[canaryMerchantsKey] = canaryMerchantsBeforeSuite;
        }
      }
    });

    it('restores preexisting values after a test overrides them', () => {
      process.env[activeDestinationsKey] = 'facebook,tiktok';
      process.env[canaryMerchantsKey] =
        '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a237';
    });
  });
});
