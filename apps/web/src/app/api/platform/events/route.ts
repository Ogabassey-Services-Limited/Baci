import { createClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
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

/**
 * Platform Events API
 *
 * POST - Track platform-level events (landing page, signups, etc.)
 *
 * Event types:
 * - landing_page_view: Visitor viewed the landing page
 * - merchant_signup_started: Visitor started signup flow
 * - merchant_signup_completed: New merchant account created
 * - merchant_first_sale: Merchant made their first sale
 * - platform_checkout: Any checkout on the platform
 * - platform_purchase: Any purchase on the platform
 */

export type PlatformEventType = PlatformEventRequestInput['event_type'];

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    const result = platformEventRequestSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: result.error.flatten() },
        { status: 400 }
      );
    }

    const {
      event_type,
      event_data,
      merchant_id,
      session_id,
      page_url,
      referrer,
    } = result.data;

    // Get request metadata
    const userAgent = request.headers.get('user-agent') || undefined;
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      undefined;

    // Insert platform event
    const { error } = await getSupabaseAdmin()
      .from('platform_events')
      .insert({
        event_type,
        event_data: event_data || {},
        merchant_id: merchant_id || null,
        session_id,
        user_agent: userAgent,
        ip_address: ipAddress,
        referrer,
        page_url,
        event_timestamp: new Date().toISOString(),
      });

    if (error) {
      console.error('Failed to insert platform event:', error);
      return NextResponse.json(
        { error: 'Failed to track event' },
        { status: 500 }
      );
    }

    // Also forward to platform's external analytics if configured
    // This runs in background, doesn't block response
    forwardToPlatformAnalytics(event_type, event_data, request).catch((err) => {
      console.warn('Failed to forward to platform analytics:', err);
    });

    return NextResponse.json({ success: true });
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
  request: NextRequest
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
          page_location: eventData?.page_url as string,
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
          eventData?.page_url as string
        );
      }
    } catch (err) {
      console.warn('Facebook CAPI forward failed:', err);
    }
  }
}
