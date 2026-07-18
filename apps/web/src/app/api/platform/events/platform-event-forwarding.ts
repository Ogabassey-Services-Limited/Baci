import type { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { PlatformEventRequestInput } from '@/schemas/platform-event';

const DEFAULT_PLATFORM_CURRENCY = 'NGN';

export type PlatformEventType = PlatformEventRequestInput['event_type'];

type PlatformEventForwardingInput = {
  eventData: PlatformEventRequestInput['event_data'];
  eventId: string;
  eventType: PlatformEventType;
  pageUrl?: string;
  request: NextRequest;
};

export async function forwardToPlatformAnalytics({
  eventData,
  eventId,
  eventType,
  pageUrl,
  request,
}: PlatformEventForwardingInput) {
  const settings = await (async () => {
    try {
      const { data, error } = await createAdminClient('event-pipeline')
        .from('platform_settings')
        .select(
          'google_analytics_id, ga4_api_secret, facebook_pixel_id, facebook_capi_token'
        )
        .single();
      if (error) {
        console.warn('Failed to load platform analytics settings');
        return null;
      }
      return data;
    } catch {
      console.warn('Failed to load platform analytics settings');
      return null;
    }
  })();
  if (!settings) return;

  const ga4EventMap: Record<PlatformEventType, string> = {
    landing_page_view: 'page_view',
    pricing_page_view: 'page_view',
    merchant_signup_started: 'begin_checkout',
    merchant_signup_completed: 'sign_up',
    merchant_first_sale: 'purchase',
    merchant_store_published: 'generate_lead',
    platform_checkout: 'begin_checkout',
    platform_purchase: 'purchase',
  };

  if (settings.google_analytics_id && settings.ga4_api_secret) {
    try {
      const { sendGA4Event, generateClientId } = await import(
        '@/lib/ga4-measurement-protocol'
      );
      await sendGA4Event(
        settings.google_analytics_id,
        settings.ga4_api_secret,
        ga4EventMap[eventType],
        {
          clientId: generateClientId(),
          ipAddress:
            request.headers.get('x-forwarded-for')?.split(',')[0] || undefined,
          userAgent: request.headers.get('user-agent') || undefined,
        },
        {
          ...(eventType === 'platform_purchase' && eventData?.value
            ? {
                currency: eventData.currency ?? DEFAULT_PLATFORM_CURRENCY,
                value: eventData.value,
              }
            : {}),
          event_id: eventId,
          page_location: pageUrl,
        }
      );
    } catch {
      console.warn('GA4 forward failed');
    }
  }

  if (settings.facebook_pixel_id && settings.facebook_capi_token) {
    try {
      const { sendFacebookCAPIEvent } = await import('@/lib/facebook-capi');
      type FacebookEventName =
        | 'PageView'
        | 'Lead'
        | 'CompleteRegistration'
        | 'Purchase'
        | 'InitiateCheckout';
      const facebookEventMap: Partial<
        Record<PlatformEventType, FacebookEventName>
      > = {
        landing_page_view: 'PageView',
        merchant_signup_completed: 'CompleteRegistration',
        merchant_store_published: 'Lead',
        platform_purchase: 'Purchase',
        merchant_signup_started: 'InitiateCheckout',
      };
      const facebookEvent = facebookEventMap[eventType];
      if (!facebookEvent) return;

      await sendFacebookCAPIEvent(
        settings.facebook_pixel_id,
        settings.facebook_capi_token,
        facebookEvent,
        {
          clientIpAddress:
            request.headers.get('x-forwarded-for')?.split(',')[0] || undefined,
          clientUserAgent: request.headers.get('user-agent') || undefined,
        },
        eventType === 'platform_purchase'
          ? {
              currency: eventData?.currency ?? DEFAULT_PLATFORM_CURRENCY,
              value: eventData?.value || 0,
            }
          : undefined,
        pageUrl,
        eventId
      );
    } catch {
      console.warn('Facebook CAPI forward failed');
    }
  }
}
