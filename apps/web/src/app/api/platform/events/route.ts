import { createClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { resolveEventIngressContext } from '@/lib/events/event-ingress-context';
import {
  isEventPipelineEnqueueEnabled,
  isLegacyAnalyticsFanoutDisabled,
} from '@/lib/events/event-pipeline-config';
import {
  requiresLegacyPlatformFanout,
  toClientPlatformDomainEventName,
} from '@/lib/events/event-route-registry';
import { readBoundedJsonBody } from '@/lib/events/read-bounded-json-body';
import { recordPlatformDomainEvent } from '@/lib/events/record-platform-domain-event';
import {
  type PlatformEventRequestInput,
  platformEventRequestSchema,
} from '@/schemas/platform-event';

// Lazy initialization to avoid build-time errors
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  );
}

/** Platform-wide default currency when an event doesn't carry its own. */
const DEFAULT_PLATFORM_CURRENCY = 'NGN';
const MAX_EVENT_BYTES = 64 * 1024;

export type PlatformEventType = PlatformEventRequestInput['event_type'];

function persistLegacyPlatformEvent(args: {
  eventData: PlatformEventRequestInput['event_data'];
  eventId: string;
  eventTimestamp: string;
  eventType: PlatformEventType;
  ipAddress?: string;
  merchantId?: string;
  pageUrl?: string;
  referrer?: string;
  sessionId?: string;
  userAgent?: string;
}) {
  return getSupabaseAdmin()
    .from('platform_events')
    .insert({
      event_data: args.eventData || {},
      event_id: args.eventId,
      event_timestamp: args.eventTimestamp,
      event_type: args.eventType,
      ip_address: args.ipAddress,
      merchant_id: args.merchantId || null,
      page_url: args.pageUrl,
      referrer: args.referrer,
      session_id: args.sessionId,
      user_agent: args.userAgent,
    });
}

export async function POST(request: NextRequest) {
  try {
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
    const result = platformEventRequestSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: result.error.flatten() },
        { status: 400 }
      );
    }

    const {
      event_type,
      event_id,
      event_data,
      merchant_id,
      session_id,
      page_url,
      referrer,
    } = result.data;
    const eventId = event_id ?? `platform_${crypto.randomUUID()}`;
    const eventTimestamp = new Date().toISOString();
    const durableEnqueue = isEventPipelineEnqueueEnabled();

    // Get request metadata
    const userAgent = request.headers.get('user-agent') || undefined;
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      undefined;

    let error: { message?: string } | null = null;
    if (durableEnqueue) {
      const context = merchant_id
        ? await resolveEventIngressContext({
            merchantId: merchant_id,
            request,
            supabase: getSupabaseAdmin(),
          })
        : {
            merchantId: '',
            ok: true as const,
            trustLevel: 'anonymous_client' as const,
            verified: false,
          };
      if (!context.ok) {
        return NextResponse.json(
          { error: context.code },
          { status: context.code === 'merchant_mismatch' ? 403 : 500 }
        );
      }

      try {
        await recordPlatformDomainEvent(getSupabaseAdmin(), {
          eventData: { ...(event_data ?? {}), page_url },
          deliveryData: { ip: ipAddress, ua: userAgent },
          eventName: toClientPlatformDomainEventName(
            event_type,
            context.trustLevel
          ),
          eventTimestamp,
          eventType: event_type,
          externalEventId: eventId,
          merchantId: context.merchantId || undefined,
          pageUrl: page_url,
          referrer,
          requestId: request.headers.get('x-request-id') ?? undefined,
          sessionId: session_id,
          trustLevel: context.trustLevel,
        });
      } catch (enqueueError) {
        if (isLegacyAnalyticsFanoutDisabled()) {
          error = {
            message:
              enqueueError instanceof Error
                ? enqueueError.message
                : 'durable_platform_enqueue_failed',
          };
        } else {
          const fallback = await persistLegacyPlatformEvent({
            eventData: event_data,
            eventId,
            eventTimestamp,
            eventType: event_type,
            ipAddress,
            merchantId: merchant_id,
            pageUrl: page_url,
            referrer,
            sessionId: session_id,
            userAgent,
          });
          error = fallback.error;
        }
      }
    } else {
      const result = await persistLegacyPlatformEvent({
        eventData: event_data,
        eventId,
        eventTimestamp,
        eventType: event_type,
        ipAddress,
        merchantId: merchant_id,
        pageUrl: page_url,
        referrer,
        sessionId: session_id,
        userAgent,
      });
      error = result.error;
    }

    if (error) {
      console.error('Failed to insert platform event:', error);
      return NextResponse.json(
        { error: 'Failed to track event' },
        { status: 500 }
      );
    }

    // Also forward to platform's external analytics if configured
    // This runs in background, doesn't block response
    if (
      !isLegacyAnalyticsFanoutDisabled() ||
      requiresLegacyPlatformFanout(event_type)
    ) {
      forwardToPlatformAnalytics(
        event_type,
        event_data,
        eventId,
        request,
        page_url
      ).catch((forwardError) => {
        console.warn('Failed to forward to platform analytics:', forwardError);
      });
    }

    return NextResponse.json({ event_id: eventId, success: true });
  } catch (error) {
    console.error('Platform events error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

type PlatformEventData = PlatformEventRequestInput['event_data'];

/**
 * Forward events to platform's configured analytics (GA4, Facebook, etc.)
 */
async function forwardToPlatformAnalytics(
  eventType: PlatformEventType,
  eventData: PlatformEventData,
  eventId: string,
  request: NextRequest,
  pageUrl?: string
) {
  // Get platform settings
  const { data: settings } = await getSupabaseAdmin()
    .from('platform_settings')
    .select(
      'google_analytics_id, ga4_api_secret, facebook_pixel_id, facebook_capi_token'
    )
    .single();

  if (!settings) return;

  // const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://baci.app';

  // Map platform events to GA4 event names
  const ga4EventMap: Record<PlatformEventType, string> = {
    landing_page_view: 'page_view',
    pricing_page_view: 'page_view',
    merchant_signup_started: 'begin_checkout', // Treat signup as conversion funnel
    merchant_signup_completed: 'sign_up',
    merchant_first_sale: 'purchase', // Merchant's success = platform success
    merchant_store_published: 'generate_lead',
    platform_checkout: 'begin_checkout',
    platform_purchase: 'purchase',
  };

  // Forward to GA4 if configured
  if (settings.google_analytics_id && settings.ga4_api_secret) {
    try {
      const { sendGA4Event, generateClientId } = await import(
        '@/lib/ga4-measurement-protocol'
      );
      await sendGA4Event(
        settings.google_analytics_id,
        settings.ga4_api_secret,
        ga4EventMap[eventType] || eventType,
        {
          clientId: generateClientId(),
          ipAddress:
            request.headers.get('x-forwarded-for')?.split(',')[0] || undefined,
          userAgent: request.headers.get('user-agent') || undefined,
        },
        {
          // Add value for purchase events. Honor the client-passed (and
          // Zod-validated) currency instead of discarding it — only fall
          // back to the platform default when the event carries none.
          ...(eventType === 'platform_purchase' && eventData?.value
            ? {
                value: eventData.value,
                currency: eventData.currency ?? DEFAULT_PLATFORM_CURRENCY,
              }
            : {}),
          // Add page info
          page_location: pageUrl,
          event_id: eventId,
        }
      );
    } catch (err) {
      console.warn('GA4 forward failed:', err);
    }
  }

  // Forward to Facebook CAPI if configured
  if (settings.facebook_pixel_id && settings.facebook_capi_token) {
    try {
      const { sendFacebookCAPIEvent } = await import('@/lib/facebook-capi');

      // Map platform events to Facebook standard events
      type FacebookEventName =
        | 'PageView'
        | 'Lead'
        | 'CompleteRegistration'
        | 'Purchase'
        | 'InitiateCheckout';

      const fbEventMap: Partial<Record<PlatformEventType, FacebookEventName>> =
        {
          landing_page_view: 'PageView',
          merchant_signup_completed: 'CompleteRegistration',
          merchant_store_published: 'Lead',
          platform_purchase: 'Purchase',
          merchant_signup_started: 'InitiateCheckout',
        };

      const fbEvent = fbEventMap[eventType];
      if (fbEvent) {
        await sendFacebookCAPIEvent(
          settings.facebook_pixel_id,
          settings.facebook_capi_token,
          fbEvent,
          {
            clientIpAddress:
              request.headers.get('x-forwarded-for')?.split(',')[0] ||
              undefined,
            clientUserAgent: request.headers.get('user-agent') || undefined,
          },
          eventType === 'platform_purchase'
            ? {
                value: eventData?.value || 0,
                currency: eventData?.currency ?? DEFAULT_PLATFORM_CURRENCY,
              }
            : undefined,
          pageUrl,
          eventId
        );
      }
    } catch (err) {
      console.warn('Facebook CAPI forward failed:', err);
    }
  }
}
