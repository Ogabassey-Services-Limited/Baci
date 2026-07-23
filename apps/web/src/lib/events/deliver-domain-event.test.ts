import type { DomainEventV1 } from '@baci/shared/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEventPipelineServiceRoleTestClient } from './event-pipeline-service-role-test-client';

const mocks = vi.hoisted(() => ({ deliver: vi.fn() }));
vi.mock('./analytics-destination-adapter', () => ({
  deliverAnalyticsEvent: mocks.deliver,
}));

import { deliverDomainEvent } from './deliver-domain-event';

const serviceClient = () =>
  createEventPipelineServiceRoleTestClient(
    vi.fn<typeof globalThis.fetch>(async () => Response.json([]))
  );

const event = {
  event_name: 'analytics.add_to_cart.v1',
} as DomainEventV1;

describe('deliverDomainEvent', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('propagates a successful adapter result', async () => {
    mocks.deliver.mockResolvedValue({
      providerResponseId: 'provider-1',
      success: true,
      terminalOutcome: 'delivered',
    });

    const result = await deliverDomainEvent({
      destination: 'facebook',
      event,
      supabase: serviceClient(),
    });

    expect(result).toEqual({
      providerResponseId: 'provider-1',
      success: true,
      terminalOutcome: 'delivered',
    });
    expect(mocks.deliver.mock.calls[0]?.[3]).toBeInstanceOf(AbortSignal);
    expect(mocks.deliver.mock.calls[0]?.[3].aborted).toBe(false);
  });

  it('marks a timed-out provider request as ambiguous', async () => {
    vi.useFakeTimers();
    mocks.deliver.mockReturnValue(new Promise(() => undefined));

    const delivery = deliverDomainEvent({
      destination: 'facebook',
      event,
      supabase: serviceClient(),
    });
    await vi.advanceTimersByTimeAsync(10_000);

    await expect(delivery).resolves.toMatchObject({
      errorCode: 'provider_request_timeout',
      requestMayHaveBeenSent: true,
      success: false,
    });
    expect(mocks.deliver.mock.calls[0]?.[3].aborted).toBe(true);
  });

  it('preserves a definite adapter failure classification', async () => {
    mocks.deliver.mockResolvedValue({
      errorCode: 'provider_rejected',
      requestMayHaveBeenSent: false,
      success: false,
    });

    await expect(
      deliverDomainEvent({
        destination: 'facebook',
        event,
        supabase: serviceClient(),
      })
    ).resolves.toEqual({
      errorCode: 'provider_rejected',
      requestMayHaveBeenSent: false,
      success: false,
    });
  });
});
