import {
  createClient as createSupabaseDirectClient,
  type SupabaseClient,
} from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import {
  normalizeEventType,
  sendToAdPlatforms,
} from '@/lib/analytics/send-to-ad-platforms';
import { resolveEventIngressContext } from '@/lib/events/event-ingress-context';
import {
  isEventPipelineEnqueueEnabled,
  isLegacyAnalyticsFanoutDisabled,
  isUnverifiedEventTelemetryEnabled,
} from '@/lib/events/event-pipeline-config';
import { toClientAnalyticsDomainEventName } from '@/lib/events/event-route-registry';
import { isEventTimestampWithinWindow } from '@/lib/events/event-timestamp-window';
import { readBoundedJsonBody } from '@/lib/events/read-bounded-json-body';
import { recordAnalyticsDomainEvent } from '@/lib/events/record-analytics-domain-event';
import { generateEventId } from '@/lib/facebook-capi';
import { logger } from '@/lib/logger';
import {
  type ConversionEventRequest,
  conversionEventRequestSchema,
} from '@/schemas/conversion-event';

const MAX_EVENT_BYTES = 64 * 1024;
const DEFAULT_MERCHANT_SLUG = 'ogabassey';
let supabaseAdmin: SupabaseClient | null = null;

function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    supabaseAdmin = createSupabaseDirectClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
    );
  }
  return supabaseAdmin;
}

async function resolveLegacyMerchant(
  merchantId: string | undefined,
  origin: string
): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  if (merchantId) {
    const { data, error } = await supabase
      .from('merchants')
      .select('id')
      .eq('id', merchantId)
      .maybeSingle();
    if (!error && data?.id) return data.id;
  }

  const slug = origin.match(/^https?:\/\/([^.]+)\./)?.[1];
  if (!slug) return null;
  const { data, error } = await supabase
    .from('merchants')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  return error ? null : (data?.id ?? null);
}

function toStoredEventData(input: ConversionEventRequest) {
  return {
    currency: input.custom_data.currency ?? 'NGN',
    item_count: input.custom_data.contents?.length,
    items: input.custom_data.contents,
    order_id: input.custom_data.order_id,
    search_string: input.custom_data.search_string,
    targets: input.targets,
    total: input.custom_data.value,
  };
}

function deliveryData(input: ConversionEventRequest, request: NextRequest) {
  return {
    email: input.user_data.em,
    external_id: input.user_data.external_id,
    fbc: input.user_data.fbc,
    fbp: input.user_data.fbp,
    ip:
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      undefined,
    phone: input.user_data.ph,
    sccid: input.user_data.sccid,
    ttclid: input.user_data.ttclid,
    ttp: input.user_data.ttp,
    ua: request.headers.get('user-agent') ?? undefined,
  };
}

async function storeLegacyConversion(
  merchantId: string,
  eventType: string,
  eventId: string,
  input: ConversionEventRequest
) {
  const { error } = await getSupabaseAdmin()
    .from('analytics_events')
    .upsert(
      {
        event_data: toStoredEventData(input),
        event_id: eventId,
        event_timestamp: new Date(input.event_time * 1000).toISOString(),
        event_type: eventType,
        merchant_id: merchantId,
        source: input.event_source,
      },
      {
        ignoreDuplicates: true,
        onConflict: 'merchant_id,event_id,event_type',
      }
    );
  if (error) {
    logger.warn({
      error,
      eventType,
      merchantId,
      message: 'Failed to log conversion event locally',
    });
  }
}

async function resolvePipelineMerchant(
  request: NextRequest,
  merchantId: string | undefined
) {
  if (!merchantId) {
    const requestContext = await resolveEventIngressContext({
      request,
      supabase: getSupabaseAdmin(),
    });
    if (requestContext.ok && requestContext.verified) return requestContext;

    const { data, error } = await getSupabaseAdmin()
      .from('merchants')
      .select('id')
      .eq('slug', DEFAULT_MERCHANT_SLUG)
      .maybeSingle();
    if (error || !data?.id) return null;
    // Preserve the pre-pipeline mobile-client default while all clients are
    // migrated to send tenant identity. This endpoint historically routed
    // such requests to this merchant, so treating it as unverified would
    // silently drop conversions after enabling the queue.
    return {
      merchantId: data.id,
      ok: true as const,
      trustLevel: 'tenant_verified_client' as const,
      verified: true,
    };
  }
  const context = await resolveEventIngressContext({
    merchantId,
    request,
    supabase: getSupabaseAdmin(),
  });
  if (!context.ok) return context;
  if (!context.verified && !isUnverifiedEventTelemetryEnabled()) return null;
  return context;
}

export async function POST(request: NextRequest) {
  const bodyResult = await readBoundedJsonBody(request, MAX_EVENT_BYTES);
  if (!bodyResult.ok && bodyResult.reason === 'too_large') {
    return NextResponse.json(
      { error: 'Event payload too large' },
      { status: 413 }
    );
  }
  if (!bodyResult.ok) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const body = bodyResult.body;

  const parsed = conversionEventRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const input = parsed.data;
  if (!isEventTimestampWithinWindow(input.event_time)) {
    return NextResponse.json(
      { error: 'Event timestamp outside allowed window' },
      { status: 400 }
    );
  }
  const eventType = normalizeEventType(input.event_name);
  if (!eventType) {
    return NextResponse.json(
      { error: 'Unsupported event name' },
      { status: 400 }
    );
  }

  const eventId = input.event_id ?? generateEventId();
  const durableEnqueue = isEventPipelineEnqueueEnabled();

  try {
    const pipelineContext = durableEnqueue
      ? await resolvePipelineMerchant(request, input.merchant_id)
      : null;
    if (durableEnqueue && !pipelineContext?.ok) {
      return NextResponse.json(
        { error: pipelineContext?.code ?? 'Unverified merchant context' },
        {
          status:
            pipelineContext?.code === 'merchant_context_error' ? 500 : 403,
        }
      );
    }

    const merchantId = pipelineContext?.ok
      ? pipelineContext.merchantId
      : await resolveLegacyMerchant(
          input.merchant_id,
          request.headers.get('origin') ?? ''
        );
    if (!merchantId) {
      return NextResponse.json(
        { error: 'Merchant context not found' },
        { status: 403 }
      );
    }

    if (pipelineContext?.ok) {
      await recordAnalyticsDomainEvent(getSupabaseAdmin(), {
        deliveryData: deliveryData(input, request),
        eventData: toStoredEventData(input),
        eventName: toClientAnalyticsDomainEventName(
          eventType,
          pipelineContext.trustLevel
        ),
        eventTimestamp: new Date(input.event_time * 1000).toISOString(),
        eventType,
        externalEventId: eventId,
        merchantId,
        requestId: request.headers.get('x-request-id') ?? undefined,
        source: input.event_source,
        trustLevel: pipelineContext.trustLevel,
      });
    } else {
      await storeLegacyConversion(merchantId, eventType, eventId, input);
    }

    const results = isLegacyAnalyticsFanoutDisabled()
      ? {}
      : await sendToAdPlatforms({
          custom_data: input.custom_data,
          event_id: eventId,
          event_type: eventType,
          merchant_id: merchantId,
          source: input.event_source,
          targets: input.targets,
          user_data: deliveryData(input, request),
        });

    logger.info({
      durableEnqueue,
      eventId,
      eventType,
      merchantId,
      message: 'Conversion event accepted',
    });
    return NextResponse.json({ event_id: eventId, results, success: true });
  } catch (error) {
    logger.error({ error, message: 'Conversion endpoint internal error' });
    return NextResponse.json(
      { error: 'Internal server error', success: false },
      { status: 500 }
    );
  }
}
