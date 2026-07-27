import { describe, expect, it, vi } from 'vitest';
import { getStorefrontCacheActuatorRequestBodySha256 } from '@/lib/events/storefront-cache-transition-actuator-client';
import { createEventPipelineServiceRoleTestClient } from '@/lib/events/event-pipeline-service-role-test-client';
import type { ServiceRoleClient } from '@/lib/supabase/service';
import { storefrontCacheActuatorSchema } from '@/schemas/storefront-cache-actuator';
import { processStorefrontCacheTransition } from './process-storefront-cache-transition';

const delivery = {
  attempt_number: 1,
  claim_token: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a230',
  domain_event_id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a234',
  generation: 4,
  id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a231',
  obligation_id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a232',
  payload: {
    merchant_id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a235',
    next_slug: 'smartphones',
    previous_slug: 'phones',
    related_slugs: ['phones', 'smartphones'],
    schema_version: 1,
  },
};

const client = { rpc: vi.fn() } as unknown as ServiceRoleClient;

function serviceClient(
  rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>
) {
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

function matchingReceipt() {
  const request = storefrontCacheActuatorSchema.parse({
    generation: delivery.generation,
    merchantId: delivery.payload.merchant_id,
    nextSlug: delivery.payload.next_slug,
    obligationId: delivery.obligation_id,
    previousSlug: delivery.payload.previous_slug,
    relatedSlugs: delivery.payload.related_slugs,
    schemaVersion: 1,
  });
  return {
    completedAt: '2026-07-27T12:00:00.000Z',
    generation: delivery.generation,
    obligationId: delivery.obligation_id,
    requestBodySha256: getStorefrontCacheActuatorRequestBodySha256(
      JSON.stringify(request)
    ),
    schemaVersion: 1,
  };
}

describe('processStorefrontCacheTransition', () => {
  it('finishes only after the exact request-bound actuator receipt succeeds', async () => {
    const callActuator = vi.fn().mockResolvedValue(matchingReceipt());
    const finishStorefrontCacheTransition = vi.fn().mockResolvedValue(true);

    await processStorefrontCacheTransition(client, delivery, {
      callActuator,
      finishStorefrontCacheTransition,
    });

    expect(callActuator).toHaveBeenCalledWith({
      generation: 4,
      merchantId: delivery.payload.merchant_id,
      nextSlug: 'smartphones',
      obligationId: delivery.obligation_id,
      previousSlug: 'phones',
      relatedSlugs: ['phones', 'smartphones'],
      schemaVersion: 1,
    });
    expect(finishStorefrontCacheTransition).toHaveBeenCalledWith(
      expect.objectContaining({
        generation: 4,
        outcome: 'delivered',
        receipt: matchingReceipt(),
      })
    );
  });

  it('retries an invalid receipt without using delivery_unknown', async () => {
    const finishStorefrontCacheTransition = vi.fn().mockResolvedValue(true);

    await processStorefrontCacheTransition(client, delivery, {
      callActuator: vi.fn().mockResolvedValue({
        ...matchingReceipt(),
        requestBodySha256: 'a'.repeat(64),
      }),
      finishStorefrontCacheTransition,
      retryDelaySeconds: () => 30,
    });

    expect(finishStorefrontCacheTransition).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: 'invalid_actuator_receipt',
        outcome: 'retry',
      })
    );
  });

  it('dead-letters a retryable actuator failure at the existing attempt ceiling', async () => {
    const finishStorefrontCacheTransition = vi.fn().mockResolvedValue(true);

    await processStorefrontCacheTransition(
      client,
      { ...delivery, attempt_number: 8 },
      {
        callActuator: vi.fn().mockRejectedValue(new Error('network unavailable')),
        finishStorefrontCacheTransition,
        maxAttempts: 8,
      }
    );

    expect(finishStorefrontCacheTransition).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: 'actuator_request_failed',
        outcome: 'dead_letter',
      })
    );
  });

  it('surfaces a stale claim when the fenced finish updates zero rows', async () => {
    const finishStorefrontCacheTransition = vi.fn().mockResolvedValue(false);

    await expect(
      processStorefrontCacheTransition(client, delivery, {
        callActuator: vi.fn().mockResolvedValue(matchingReceipt()),
        finishStorefrontCacheTransition,
      })
    ).rejects.toThrow('storefront_cache_transition_finish_stale');
  });

  it('sends explicit SQL nulls for omitted terminal finish arguments', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });

    await processStorefrontCacheTransition(serviceClient(rpc), delivery, {
      callActuator: vi.fn().mockResolvedValue(matchingReceipt()),
    });

    expect(rpc).toHaveBeenCalledWith(
      'finish_storefront_cache_transition_delivery_v1',
      expect.objectContaining({
        p_available_at: null,
        p_error_code: null,
        p_error_message: null,
        p_http_status: null,
        p_receipt: matchingReceipt(),
      })
    );
  });

  it('does not issue a second finish after a successful barrier hits finish transport failure', async () => {
    const callActuator = vi.fn().mockResolvedValue(matchingReceipt());
    const finishStorefrontCacheTransition = vi
      .fn()
      .mockRejectedValue(new Error('finish transport unavailable'));

    await expect(
      processStorefrontCacheTransition(client, delivery, {
        callActuator,
        finishStorefrontCacheTransition,
      })
    ).rejects.toThrow('finish transport unavailable');

    expect(callActuator).toHaveBeenCalledOnce();
    expect(finishStorefrontCacheTransition).toHaveBeenCalledOnce();
  });

  it('retries a malformed authoritative obligation without calling the actuator', async () => {
    const callActuator = vi.fn();
    const finishStorefrontCacheTransition = vi.fn().mockResolvedValue(true);

    await processStorefrontCacheTransition(
      client,
      { ...delivery, payload: { schema_version: 1 } },
      { callActuator, finishStorefrontCacheTransition }
    );

    expect(callActuator).not.toHaveBeenCalled();
    expect(finishStorefrontCacheTransition).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: 'invalid_obligation_payload',
        outcome: 'retry',
      })
    );
  });

  it('reruns the full actuator barrier after a retry rather than resuming a checkpoint', async () => {
    const callActuator = vi.fn().mockResolvedValue(matchingReceipt());
    const finishStorefrontCacheTransition = vi.fn().mockResolvedValue(true);

    await processStorefrontCacheTransition(client, delivery, {
      callActuator,
      finishStorefrontCacheTransition,
    });
    await processStorefrontCacheTransition(
      client,
      { ...delivery, attempt_number: 2 },
      { callActuator, finishStorefrontCacheTransition }
    );

    expect(callActuator).toHaveBeenCalledTimes(2);
    expect(finishStorefrontCacheTransition).toHaveBeenCalledTimes(2);
  });
});
