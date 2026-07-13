import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { after, type NextRequest, NextResponse } from 'next/server';
import {
  isConversionEvent,
  normalizeEventType,
  sendToAdPlatforms,
} from '@/lib/analytics/send-to-ad-platforms';
import { buildAnalyticsEventData } from '@/lib/events/build-analytics-event-data';
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
import { logger } from '@/lib/logger';
import {
  type AnalyticsEventRequest,
  analyticsEventRequestSchema,
} from '@/schemas/analytics-event';

const MAX_EVENT_BYTES = 64 * 1024;
let supabaseAdmin: SupabaseClient | null = null;

function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
    );
  }
  return supabaseAdmin;
}

function conversionContents(input: AnalyticsEventRequest) {
  const items = input.items ?? input.custom_data?.contents ?? [];
  return items.flatMap((item) => {
    const id = item.id ?? item.product_id;
    if (!id) return [];
    return [
      {
        id,
        name: item.name ?? item.product_name,
        price: item.price,
        quantity: item.quantity,
      },
    ];
  });
}

function deliveryData(input: AnalyticsEventRequest, request: NextRequest) {
  return {
    email: input.user_data?.em,
    external_id: input.user_data?.external_id,
    fbc: input.user_data?.fbc ?? request.cookies.get('_fbc')?.value,
    fbp: input.user_data?.fbp ?? request.cookies.get('_fbp')?.value,
    ip:
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      undefined,
    phone: input.user_data?.ph,
    sccid: input.user_data?.sccid ?? request.cookies.get('ScCid')?.value,
    ttclid: input.user_data?.ttclid,
    ttp: input.user_data?.ttp ?? request.cookies.get('_ttp')?.value,
    ua: request.headers.get('user-agent') ?? undefined,
  };
}

function storeLegacyEvent(
  supabase: SupabaseClient,
  input: AnalyticsEventRequest,
  eventType: string,
  eventData: Record<string, unknown>,
  eventTimestamp: string
) {
  const row = {
    event_data: eventData,
    event_timestamp: eventTimestamp,
    merchant_id: input.merchant_id,
    source: input.source ?? 'web',
    event_type: eventType,
  };
  if (input.event_id) {
    return supabase.from('analytics_events').upsert(
      { ...row, event_id: input.event_id },
      {
        ignoreDuplicates: true,
        onConflict: 'merchant_id,event_id,event_type',
      }
    );
  }
  return supabase.from('analytics_events').insert(row);
}

function scheduleLegacyFanout(
  request: NextRequest,
  input: AnalyticsEventRequest,
  eventType: string,
  eventId: string
) {
  after(async () => {
    try {
      const contents = conversionContents(input);
      await sendToAdPlatforms({
        custom_data: {
          content_name: input.product_name ?? input.custom_data?.content_name,
          content_type: input.custom_data?.content_type ?? 'product',
          contents:
            contents.length > 0
              ? contents
              : input.product_id
                ? [
                    {
                      id: input.product_id,
                      name: input.product_name,
                      price: input.product_price,
                      quantity: input.quantity ?? 1,
                    },
                  ]
                : undefined,
          currency: input.currency ?? input.custom_data?.currency ?? 'NGN',
          order_id: input.order_id ?? input.custom_data?.order_id,
          price: input.product_price ?? input.custom_data?.price,
          search_string: input.search_term ?? input.custom_data?.search_string,
          url: input.page_url ?? input.custom_data?.url,
          value: input.total ?? input.custom_data?.value ?? input.product_price,
        },
        event_id: eventId,
        event_type: eventType,
        merchant_id: input.merchant_id,
        source: input.source ?? 'web',
        user_data: deliveryData(input, request),
      });
    } catch (error) {
      logger.error({ error, message: 'CAPI fan-out error after response' });
    }
  });
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

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }
  const raw = body as Record<string, unknown>;
  if (!(raw.event_type || raw.event_name) || !raw.merchant_id) {
    return NextResponse.json(
      { error: 'Missing required fields: event_type and merchant_id' },
      { status: 400 }
    );
  }
  const parsed = analyticsEventRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const input = parsed.data;
  if (input.timestamp && !isEventTimestampWithinWindow(input.timestamp)) {
    return NextResponse.json(
      { error: 'Event timestamp outside allowed window' },
      { status: 400 }
    );
  }
  const rawEventType = input.event_type ?? input.event_name ?? '';
  const eventType = normalizeEventType(rawEventType) ?? rawEventType;
  const eventData = buildAnalyticsEventData(input, eventType);
  const eventTimestamp = input.timestamp ?? new Date().toISOString();
  const durableEnqueue = isEventPipelineEnqueueEnabled();
  let responseEventId = input.event_id;

  try {
    const supabase = getSupabaseAdmin();
    if (durableEnqueue) {
      const context = await resolveEventIngressContext({
        merchantId: input.merchant_id,
        pageUrl: input.page_url ?? request.headers.get('referer') ?? undefined,
        request,
        supabase,
      });
      if (!context.ok) {
        return NextResponse.json(
          { code: context.code, error: 'Failed to resolve event context' },
          { status: context.code === 'merchant_mismatch' ? 403 : 500 }
        );
      }
      if (!context.verified && !isUnverifiedEventTelemetryEnabled()) {
        return NextResponse.json(
          { error: 'Unverified merchant context' },
          { status: 403 }
        );
      }

      responseEventId = input.event_id ?? `evt_${crypto.randomUUID()}`;
      try {
        await recordAnalyticsDomainEvent(supabase, {
          deliveryData: deliveryData(input, request),
          eventData,
          eventName: toClientAnalyticsDomainEventName(
            eventType,
            context.trustLevel
          ),
          eventTimestamp,
          eventType,
          externalEventId: responseEventId,
          merchantId: context.merchantId,
          requestId: request.headers.get('x-request-id') ?? undefined,
          source: input.source ?? 'web',
          trustLevel: context.trustLevel,
        });
      } catch (error) {
        if (isLegacyAnalyticsFanoutDisabled()) throw error;

        logger.warn({
          error,
          message:
            'Durable analytics enqueue failed; preserving the event through the legacy shadow path',
        });
        const { error: legacyError } = await storeLegacyEvent(
          supabase,
          { ...input, event_id: responseEventId },
          eventType,
          eventData,
          eventTimestamp
        );
        if (legacyError) throw legacyError;
      }
    } else {
      const { error } = await storeLegacyEvent(
        supabase,
        input,
        eventType,
        eventData,
        eventTimestamp
      );
      if (error) {
        logger.error({ error, message: 'Failed to store analytics event' });
        return NextResponse.json(
          { error: 'Failed to store event' },
          { status: 500 }
        );
      }
    }

    if (isConversionEvent(eventType) && !isLegacyAnalyticsFanoutDisabled()) {
      const fanoutEventId =
        responseEventId ??
        `evt_${Date.now()}_${crypto.randomUUID().replace(/-/g, '')}`;
      scheduleLegacyFanout(request, input, eventType, fanoutEventId);
    }

    return NextResponse.json({ success: true, event_id: responseEventId });
  } catch (error) {
    logger.error({ error, message: 'Event tracking error' });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
