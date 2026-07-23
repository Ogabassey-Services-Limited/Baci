import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEventPipelineServiceRoleTestClient } from '@/lib/events/event-pipeline-service-role-test-client';

const mocks = vi.hoisted(() => ({ deliver: vi.fn() }));
vi.mock('@/lib/events/deliver-domain-event', () => ({
  deliverDomainEvent: mocks.deliver,
}));

import { processClaimedEventDelivery } from './process-claimed-event-delivery';

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

const delivery = {
  attempt_number: 1,
  claim_token: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a230',
  claimed_at: '2026-07-12T12:00:00.000Z',
  destination: 'facebook' as const,
  domain_event_id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a234',
  id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a231',
  payload: {
    data: { event_data: {}, event_type: 'add_to_cart' },
    domain_event_id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a234',
    event_name: 'analytics.add_to_cart.v1',
    external_event_id: 'event-1',
    idempotency_key: 'event-1',
    merchant_id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a235',
    metadata: { environment: 'test' },
    occurred_at: '2026-07-12T12:00:00.000Z',
    producer: 'web',
    schema_version: 1,
    source: {},
    subject: { id: 'event-1', type: 'analytics_event' },
    trust_level: 'tenant_verified_client',
  },
};

describe('processClaimedEventDelivery', () => {
  beforeEach(() => vi.clearAllMocks());

  it('finishes a successful attempt with its claim token', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    mocks.deliver.mockResolvedValue({
      success: true,
      terminalOutcome: 'delivered',
    });

    await processClaimedEventDelivery(client(rpc), delivery, 8);

    expect(rpc).toHaveBeenCalledWith(
      'finish_event_delivery_v1',
      expect.objectContaining({
        p_claim_token: delivery.claim_token,
        p_delivery_id: delivery.id,
        p_outcome: 'delivered',
      })
    );
  });

  it('does not retry an ambiguous provider timeout', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    mocks.deliver.mockResolvedValue({
      errorCode: 'provider_request_timeout',
      requestMayHaveBeenSent: true,
      success: false,
    });

    await processClaimedEventDelivery(client(rpc), delivery, 8);

    expect(rpc).toHaveBeenCalledWith(
      'finish_event_delivery_v1',
      expect.objectContaining({ p_outcome: 'delivery_unknown' })
    );
  });

  it('dead-letters an identity-mismatched payload before provider delivery', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });

    await processClaimedEventDelivery(
      client(rpc),
      { ...delivery, domain_event_id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a299' },
      8
    );

    expect(mocks.deliver).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith(
      'finish_event_delivery_v1',
      expect.objectContaining({ p_outcome: 'dead_letter' })
    );
  });

  it('dead-letters attempts beyond the configured maximum', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });

    await processClaimedEventDelivery(
      client(rpc),
      { ...delivery, attempt_number: 9 },
      8
    );

    expect(mocks.deliver).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith(
      'finish_event_delivery_v1',
      expect.objectContaining({
        p_error_code: 'max_attempts_exceeded',
        p_outcome: 'dead_letter',
      })
    );
  });
});
