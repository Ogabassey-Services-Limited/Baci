import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ deliver: vi.fn() }));
vi.mock('@/lib/events/deliver-domain-event', () => ({
  deliverDomainEvent: mocks.deliver,
}));

import {
  getEventDeliveryClaimBatchSize,
  processClaimedEventDelivery,
} from './process-event-deliveries';

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

    await processClaimedEventDelivery({ rpc } as never, delivery, 8);

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

    await processClaimedEventDelivery({ rpc } as never, delivery, 8);

    expect(rpc).toHaveBeenCalledWith(
      'finish_event_delivery_v1',
      expect.objectContaining({ p_outcome: 'delivery_unknown' })
    );
  });

  it('dead-letters an identity-mismatched payload before provider delivery', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });

    await processClaimedEventDelivery(
      { rpc } as never,
      { ...delivery, domain_event_id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a299' },
      8
    );

    expect(mocks.deliver).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith(
      'finish_event_delivery_v1',
      expect.objectContaining({ p_outcome: 'dead_letter' })
    );
  });
});

describe('getEventDeliveryClaimBatchSize', () => {
  it('keeps claimed work within two bounded concurrency waves', () => {
    expect(getEventDeliveryClaimBatchSize(1)).toBe(2);
    expect(getEventDeliveryClaimBatchSize(5)).toBe(10);
    expect(getEventDeliveryClaimBatchSize(100)).toBe(25);
  });
});
