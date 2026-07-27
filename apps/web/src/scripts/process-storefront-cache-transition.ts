import { z } from 'zod';
import {
  callStorefrontCacheActuator,
  getStorefrontCacheActuatorRequestBodySha256,
  StorefrontCacheTransitionActuatorFailure,
} from '@/lib/events/storefront-cache-transition-actuator-client';
import { getEventDeliveryMaxAttempts } from '@/lib/events/event-pipeline-config';
import { getEventRetryDelaySeconds } from '@/lib/events/event-retry-delay';
import { sanitizeEventErrorMessage } from '@/lib/events/sanitize-event-error';
import type { ServiceRoleClient } from '@/lib/supabase/service';
import { categorySlugSchema } from '@/schemas/category-slug';
import {
  storefrontCacheActuatorReceiptSchema,
  storefrontCacheActuatorSchema,
  type StorefrontCacheActuatorReceipt,
  type StorefrontCacheActuatorRequest,
} from '@/schemas/storefront-cache-actuator';

const sqlNullNumber: number = JSON.parse('null');
const sqlNullString: string = JSON.parse('null');

const claimedStorefrontCacheTransitionSchema = z.strictObject({
  attempt_number: z.number().int().positive(),
  claim_token: z.uuid(),
  domain_event_id: z.uuid(),
  generation: z.number().int().positive(),
  id: z.uuid(),
  obligation_id: z.uuid(),
  payload: z.unknown(),
});

const obligationPayloadSchema = z
  .object({
    merchant_id: z.uuid(),
    next_slug: categorySlugSchema.optional(),
    previous_slug: categorySlugSchema.optional(),
    related_slugs: z.array(categorySlugSchema).max(32).default([]),
    schema_version: z.literal(1),
  })
  .strict();

type ClaimedStorefrontCacheTransition = z.infer<
  typeof claimedStorefrontCacheTransitionSchema
>;
type FinishOutcome = 'dead_letter' | 'delivered' | 'retry';

interface FinishArguments {
  availableAt?: string;
  claimToken: string;
  deliveryId: string;
  errorCode?: string;
  errorMessage?: string;
  generation: number;
  httpStatus?: number;
  obligationId: string;
  outcome: FinishOutcome;
  receipt?: StorefrontCacheActuatorReceipt;
}

interface ProcessStorefrontCacheTransitionDependencies {
  callActuator?: (
    request: StorefrontCacheActuatorRequest
  ) => Promise<unknown>;
  finishStorefrontCacheTransition?: (args: FinishArguments) => Promise<boolean>;
  maxAttempts?: number;
  now?: () => number;
  retryDelaySeconds?: (attempt: number) => number;
}

function toActuatorRequest(
  delivery: ClaimedStorefrontCacheTransition
): StorefrontCacheActuatorRequest {
  const parsed = obligationPayloadSchema.safeParse(delivery.payload);
  if (!parsed.success) {
    throw new StorefrontCacheTransitionActuatorFailure(
      'invalid_obligation_payload'
    );
  }
  const payload = parsed.data;
  return storefrontCacheActuatorSchema.parse({
    generation: delivery.generation,
    merchantId: payload.merchant_id,
    nextSlug: payload.next_slug ?? null,
    obligationId: delivery.obligation_id,
    previousSlug: payload.previous_slug ?? null,
    relatedSlugs: payload.related_slugs,
    schemaVersion: 1,
  });
}

async function finishStorefrontCacheTransition(
  supabase: ServiceRoleClient,
  args: FinishArguments
): Promise<boolean> {
  const { data, error } = await supabase.rpc(
    'finish_storefront_cache_transition_delivery_v1',
    {
      p_available_at: args.availableAt ?? sqlNullString,
      p_claim_token: args.claimToken,
      p_delivery_id: args.deliveryId,
      p_error_code: args.errorCode ?? sqlNullString,
      p_error_message:
        sanitizeEventErrorMessage(args.errorMessage) ?? sqlNullString,
      p_generation: args.generation,
      p_http_status: args.httpStatus ?? sqlNullNumber,
      p_obligation_id: args.obligationId,
      p_outcome: args.outcome,
      p_receipt: args.receipt ?? null,
    }
  );
  if (error) {
    throw new Error('storefront_cache_transition_finish_failed', {
      cause: error,
    });
  }
  if (data !== true) throw new Error('storefront_cache_transition_finish_stale');
  return true;
}

function isExactReceipt(
  receipt: unknown,
  request: StorefrontCacheActuatorRequest
): receipt is StorefrontCacheActuatorReceipt {
  const parsed = storefrontCacheActuatorReceiptSchema.safeParse(receipt);
  return (
    parsed.success &&
    parsed.data.generation === request.generation &&
    parsed.data.obligationId === request.obligationId &&
    parsed.data.requestBodySha256 ===
      getStorefrontCacheActuatorRequestBodySha256(JSON.stringify(request))
  );
}

function failureDetails(error: unknown) {
  if (error instanceof StorefrontCacheTransitionActuatorFailure) {
    return {
      code: error.code,
      httpStatus: error.httpStatus,
      message: error.message,
    };
  }
  return {
    code: 'actuator_request_failed',
    message: error instanceof Error ? error.message : 'actuator_request_failed',
  };
}

async function finishOrThrow(
  finish: (args: FinishArguments) => Promise<boolean>,
  args: FinishArguments
): Promise<void> {
  if (!(await finish(args))) {
    throw new Error('storefront_cache_transition_finish_stale');
  }
}

async function finishFailure({
  claimed,
  error,
  finish,
  maxAttempts,
  now,
  retryDelaySeconds,
}: {
  claimed: ClaimedStorefrontCacheTransition;
  error: unknown;
  finish: (args: FinishArguments) => Promise<boolean>;
  maxAttempts: number;
  now: () => number;
  retryDelaySeconds: (attempt: number) => number;
}): Promise<void> {
  const failure = failureDetails(error);
  const outcome: FinishOutcome =
    claimed.attempt_number >= maxAttempts ? 'dead_letter' : 'retry';
  await finishOrThrow(finish, {
    availableAt:
      outcome === 'retry'
        ? new Date(
            now() + retryDelaySeconds(claimed.attempt_number) * 1_000
          ).toISOString()
        : undefined,
    claimToken: claimed.claim_token,
    deliveryId: claimed.id,
    errorCode: failure.code,
    errorMessage: failure.message,
    generation: claimed.generation,
    httpStatus: failure.httpStatus,
    obligationId: claimed.obligation_id,
    outcome,
  });
}

async function processStorefrontCacheTransition(
  supabase: ServiceRoleClient,
  delivery: ClaimedStorefrontCacheTransition,
  dependencies: ProcessStorefrontCacheTransitionDependencies = {}
): Promise<void> {
  const parsedDelivery = claimedStorefrontCacheTransitionSchema.safeParse(delivery);
  if (!parsedDelivery.success) {
    throw new Error('storefront_cache_transition_claim_invalid');
  }
  const claimed = parsedDelivery.data;
  const finish =
    dependencies.finishStorefrontCacheTransition ??
    ((args: FinishArguments) => finishStorefrontCacheTransition(supabase, args));
  const maxAttempts = dependencies.maxAttempts ?? getEventDeliveryMaxAttempts();
  const now = dependencies.now ?? Date.now;
  const retryDelaySeconds =
    dependencies.retryDelaySeconds ?? getEventRetryDelaySeconds;

  let request: StorefrontCacheActuatorRequest;
  let receipt: unknown;
  try {
    request = toActuatorRequest(claimed);
    receipt = await (dependencies.callActuator ?? callStorefrontCacheActuator)(
      request
    );
    if (!isExactReceipt(receipt, request)) {
      throw new StorefrontCacheTransitionActuatorFailure(
        'invalid_actuator_receipt'
      );
    }
  } catch (error) {
    await finishFailure({
      claimed,
      error,
      finish,
      maxAttempts,
      now,
      retryDelaySeconds,
    });
    return;
  }

  await finishOrThrow(finish, {
    claimToken: claimed.claim_token,
    deliveryId: claimed.id,
    generation: claimed.generation,
    obligationId: claimed.obligation_id,
    outcome: 'delivered',
    receipt,
  });
}

async function claimStorefrontCacheTransitionBatch(
  supabase: ServiceRoleClient,
  workerId: string
): Promise<ClaimedStorefrontCacheTransition[]> {
  const { data, error } = await supabase.rpc(
    'claim_storefront_cache_transition_deliveries_v1',
    {
      p_batch_size: 1,
      p_deadline_seconds: 55,
      p_lease_seconds: 60,
      p_worker_id: workerId,
    }
  );
  if (error) {
    throw new Error('storefront_cache_transition_claim_failed', {
      cause: error,
    });
  }
  const parsed = claimedStorefrontCacheTransitionSchema.array().safeParse(
    data ?? []
  );
  if (!parsed.success) {
    throw new Error('storefront_cache_transition_claim_invalid');
  }
  return parsed.data;
}

export {
  claimStorefrontCacheTransitionBatch,
  processStorefrontCacheTransition,
};
