import type { z } from 'zod';
import { deliverDomainEvent } from '@/lib/events/deliver-domain-event';
import { parseDomainEventV1 } from '@/lib/events/event-contract';
import { classifyDeliveryFailure } from '@/lib/events/event-error-classification';
import { getEventDeliveryMaxAttempts } from '@/lib/events/event-pipeline-config';
import { getEventRetryDelaySeconds } from '@/lib/events/event-retry-delay';
import { sanitizeEventErrorMessage } from '@/lib/events/sanitize-event-error';
import type { ServiceRoleClient } from '@/lib/supabase/service';
import { claimedEventDeliverySchema } from '@/schemas/claimed-event-delivery-schema';

type ClaimedEventDelivery = z.infer<typeof claimedEventDeliverySchema>;

async function finishDelivery(
  supabase: ServiceRoleClient,
  delivery: ClaimedEventDelivery,
  outcome: 'dead_letter' | 'delivered' | 'delivery_unknown' | 'retry' | 'skipped',
  options: {
    availableAt?: string;
    errorCode?: string;
    errorMessage?: string;
    httpStatus?: number;
    providerResponseId?: string;
  } = {}
) {
  const { data, error } = await supabase.rpc('finish_event_delivery_v1', {
    p_available_at: options.availableAt,
    p_claim_token: delivery.claim_token,
    p_delivery_id: delivery.id,
    p_error_code: options.errorCode,
    p_error_message: sanitizeEventErrorMessage(options.errorMessage),
    p_http_status: options.httpStatus,
    p_outcome: outcome,
    p_provider_response_id: options.providerResponseId,
  });
  if (error) throw new Error('event_delivery_finish_failed', { cause: error });
  if (data !== true) throw new Error('stale_event_delivery_claim');
}

async function processClaimedEventDelivery(
  supabase: ServiceRoleClient,
  delivery: ClaimedEventDelivery,
  maxAttempts = getEventDeliveryMaxAttempts()
): Promise<void> {
  const parsedDelivery = claimedEventDeliverySchema.safeParse(delivery);
  if (!parsedDelivery.success) throw new Error('event_delivery_claim_invalid');
  const claimed = parsedDelivery.data;
  if (claimed.attempt_number > maxAttempts) {
    await finishDelivery(supabase, claimed, 'dead_letter', {
      errorCode: 'max_attempts_exceeded',
      errorMessage: 'Delivery exceeded the configured attempt limit',
    });
    return;
  }

  const parsed = parseDomainEventV1(claimed.payload);
  if (!parsed.success || parsed.event.domain_event_id !== claimed.domain_event_id) {
    await finishDelivery(supabase, claimed, 'dead_letter', {
      errorCode: 'invalid_destination_payload',
      errorMessage: parsed.success
        ? 'Delivery payload identity mismatch'
        : `parser_v1:${parsed.issues.join(',')}`,
    });
    return;
  }

  const result = await deliverDomainEvent({
    destination: claimed.destination,
    event: parsed.event,
    supabase,
  });
  if (result.success) {
    await finishDelivery(
      supabase,
      claimed,
      result.terminalOutcome ?? 'delivered',
      { providerResponseId: result.providerResponseId }
    );
    return;
  }

  const outcome = classifyDeliveryFailure({
    attempt: claimed.attempt_number,
    errorCode: result.errorCode,
    errorMessage: result.errorMessage,
    httpStatus: result.httpStatus,
    maxAttempts,
    requestMayHaveBeenSent: result.requestMayHaveBeenSent,
  });
  await finishDelivery(supabase, claimed, outcome, {
    availableAt:
      outcome === 'retry'
        ? new Date(
            Date.now() + getEventRetryDelaySeconds(claimed.attempt_number) * 1_000
          ).toISOString()
        : undefined,
    errorCode: result.errorCode ?? 'provider_failure',
    errorMessage: result.errorMessage,
    httpStatus: result.httpStatus,
    providerResponseId: result.providerResponseId,
  });
}

export { processClaimedEventDelivery };
