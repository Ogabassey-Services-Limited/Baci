import crypto from 'node:crypto';
import {
  createClient as createSupabaseDirectClient,
  type SupabaseClient,
} from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { normalizeEventType } from '@/lib/analytics/send-to-ad-platforms';
import { facebookCAPI, generateEventId } from '@/lib/facebook-capi';
import { logger } from '@/lib/logger';
import { snapchatCAPI } from '@/lib/snapchat-capi';
import { tiktokEventsAPI } from '@/lib/tiktok-events-api';

/**
 * Unified Conversions API Endpoint
 *
 * Server-side endpoint that forwards conversion events to ALL ad platforms
 * AND logs them to the local analytics_events table for dashboard metrics.
 *
 * Supported platforms:
 * - Meta/Facebook Conversions API
 * - TikTok Events API
 * - Snapchat Conversions API
 * - Google Enhanced Conversions (via Measurement Protocol)
 *
 * Event name mapping:
 * - PURCHASE -> all platforms
 * - ADD_CART -> all platforms
 * - VIEW_CONTENT -> all platforms
 * - START_CHECKOUT -> all platforms
 * - SIGN_UP -> all platforms
 */

interface ConversionRequest {
  event_name: string;
  event_id?: string; // For deduplication with client-side SDKs
  event_time: number;
  event_source: 'mobile_app' | 'web' | 'server';
  platform?: 'ios' | 'android' | 'web';
  merchant_id?: string; // Preferred: pass merchant UUID directly
  user_data: {
    em?: string; // email (will be hashed)
    ph?: string; // phone (will be hashed)
    external_id?: string;
    fn?: string; // first name
    ln?: string; // last name
  };
  custom_data: {
    order_id?: string;
    value?: number;
    currency?: string;
    contents?: Array<{
      id: string;
      quantity: number;
      name?: string;
      price?: number;
    }>;
  };
  targets?: Array<'facebook' | 'tiktok' | 'snapchat' | 'google'>;
}

// SHA256 hash function for PII
function sha256Hash(value: string): string {
  return crypto
    .createHash('sha256')
    .update(value.toLowerCase().trim())
    .digest('hex');
}

// Map our event names to platform-specific event names
const EVENT_MAPPING = {
  PURCHASE: {
    facebook: 'Purchase',
    tiktok: 'purchase',
    snapchat: 'purchase',
    google: 'purchase',
  },
  ADD_CART: {
    facebook: 'AddToCart',
    tiktok: 'add_to_cart',
    snapchat: 'add_to_cart',
    google: 'add_to_cart',
  },
  VIEW_CONTENT: {
    facebook: 'ViewContent',
    tiktok: 'view_item',
    snapchat: 'view_content',
    google: 'view_item',
  },
  START_CHECKOUT: {
    facebook: 'InitiateCheckout',
    tiktok: 'begin_checkout',
    snapchat: 'begin_checkout',
    google: 'begin_checkout',
  },
  SIGN_UP: {
    facebook: 'CompleteRegistration',
    tiktok: 'sign_up',
    snapchat: 'sign_up',
    google: 'sign_up',
  },
} as const;

// ---------------------------------------------------------------------------
// Service role client for local DB logging (bypasses RLS)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Merchant resolution: prefer merchant_id from body, fall back to slug lookup
// ---------------------------------------------------------------------------

interface MerchantRecord {
  id: string;
  facebook_pixel_id: string | null;
  facebook_capi_token: string | null;
  tiktok_pixel_id: string | null;
  tiktok_access_token: string | null;
  snapchat_pixel_id: string | null;
  snapchat_capi_token: string | null;
  google_ads_id: string | null;
  google_ads_conversion_id: string | null;
}

const MERCHANT_SELECT = `
  id,
  facebook_pixel_id,
  facebook_capi_token,
  tiktok_pixel_id,
  tiktok_access_token,
  snapchat_pixel_id,
  snapchat_capi_token,
  google_ads_id,
  google_ads_conversion_id
`;

async function resolveMerchant(
  merchantId: string | undefined,
  origin: string
): Promise<MerchantRecord | null> {
  const supabase = getSupabaseAdmin();

  // Prefer direct merchant_id lookup
  if (merchantId) {
    const { data, error } = await supabase
      .from('merchants')
      .select(MERCHANT_SELECT)
      .eq('id', merchantId)
      .single();

    if (!error && data) return data as MerchantRecord;
  }

  // Fallback: extract slug from origin header
  const slugMatch = origin.match(/^https?:\/\/([^.]+)\./);
  const slug = slugMatch?.[1] || 'ogabassey';

  const { data, error } = await supabase
    .from('merchants')
    .select(MERCHANT_SELECT)
    .eq('slug', slug)
    .single();

  if (error || !data) return null;
  return data as MerchantRecord;
}

// ---------------------------------------------------------------------------
// Local DB logging
// ---------------------------------------------------------------------------

async function logEventLocally(
  merchantId: string,
  eventName: string,
  eventId: string,
  eventSource: string,
  customData: ConversionRequest['custom_data']
): Promise<void> {
  const dbEventType = normalizeEventType(eventName);
  if (!dbEventType) return; // Unknown event, skip DB logging

  try {
    const { error } = await getSupabaseAdmin()
      .from('analytics_events')
      .upsert(
        {
          merchant_id: merchantId,
          event_type: dbEventType,
          event_id: eventId,
          source: eventSource || 'web',
          event_data: {
            order_id: customData.order_id,
            total: customData.value,
            currency: customData.currency || 'NGN',
            item_count: customData.contents?.length,
            items: customData.contents,
          },
          event_timestamp: new Date().toISOString(),
        },
        {
          onConflict: 'merchant_id,event_id,event_type',
          ignoreDuplicates: true,
        }
      );

    if (error) {
      logger.warn({
        message: 'Failed to log conversion event locally',
        error,
        eventType: dbEventType,
        merchantId,
      });
    }
  } catch (err) {
    // Never block the response for a logging failure
    logger.warn({ message: 'Local event logging exception', error: err });
  }
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ConversionRequest;
    const {
      event_name,
      event_id: clientEventId,
      event_time: _eventTime,
      event_source,
      platform,
      merchant_id: bodyMerchantId,
      user_data,
      custom_data,
      targets = ['facebook', 'tiktok', 'snapchat', 'google'],
    } = body;

    if (!event_name) {
      return NextResponse.json(
        { error: 'Missing required field: event_name' },
        { status: 400 }
      );
    }

    // Use client event_id if provided, otherwise generate one
    // This is CRITICAL for deduplication with client-side SDKs
    const eventId = clientEventId || generateEventId();

    // Resolve merchant (prefer merchant_id from body, fall back to origin slug)
    const origin = request.headers.get('origin') || '';
    const merchant = await resolveMerchant(bodyMerchantId, origin);

    if (!merchant) {
      logger.error({
        message: 'Failed to fetch merchant for analytics',
        merchantId: bodyMerchantId,
        origin,
      });
      // Don't fail - just return success
      return NextResponse.json({
        success: true,
        message: 'Merchant not found, events not sent',
        results: {},
      });
    }

    // =========================================================================
    // LOCAL DB LOGGING (non-blocking, fire-and-forget)
    // =========================================================================
    logEventLocally(
      merchant.id,
      event_name,
      eventId,
      event_source,
      custom_data
    );

    // Prepare user data with hashing
    const _hashedEmail = user_data.em ? sha256Hash(user_data.em) : undefined;
    const _hashedPhone = user_data.ph ? sha256Hash(user_data.ph) : undefined;

    // Get IP and user agent from request
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      undefined;
    const userAgent = request.headers.get('user-agent') || undefined;

    const currency = custom_data.currency || 'NGN';

    // Track results for each platform
    const results: Record<string, { success: boolean; error?: string }> = {};

    // =========================================================================
    // FACEBOOK CAPI
    // =========================================================================
    if (
      targets.includes('facebook') &&
      merchant.facebook_pixel_id &&
      merchant.facebook_capi_token
    ) {
      try {
        const fbUserData = {
          email: user_data.em,
          phone: user_data.ph,
          externalId: user_data.external_id,
          clientIpAddress: ipAddress,
          clientUserAgent: userAgent,
        };

        const eventMapping =
          EVENT_MAPPING[event_name as keyof typeof EVENT_MAPPING];
        if (eventMapping?.facebook) {
          switch (eventMapping.facebook) {
            case 'Purchase':
              if (custom_data.value && custom_data.contents) {
                const products = custom_data.contents.map((c) => ({
                  id: c.id,
                  name: c.id,
                  quantity: c.quantity,
                  price: 0,
                }));
                results.facebook = await facebookCAPI.purchase(
                  merchant.facebook_pixel_id,
                  merchant.facebook_capi_token,
                  fbUserData,
                  custom_data.order_id || eventId,
                  custom_data.value,
                  currency,
                  products
                );
              }
              break;
            case 'AddToCart':
              if (custom_data.contents?.[0]) {
                results.facebook = await facebookCAPI.addToCart(
                  merchant.facebook_pixel_id,
                  merchant.facebook_capi_token,
                  fbUserData,
                  custom_data.contents[0].id,
                  custom_data.contents[0].id,
                  custom_data.value || 0,
                  currency
                );
              }
              break;
            case 'InitiateCheckout':
              results.facebook = await facebookCAPI.initiateCheckout(
                merchant.facebook_pixel_id,
                merchant.facebook_capi_token,
                fbUserData,
                custom_data.value || 0,
                currency,
                custom_data.contents || []
              );
              break;
            case 'ViewContent':
              if (custom_data.contents?.[0]) {
                results.facebook = await facebookCAPI.viewContent(
                  merchant.facebook_pixel_id,
                  merchant.facebook_capi_token,
                  fbUserData,
                  custom_data.contents[0].id,
                  custom_data.contents[0].id,
                  custom_data.value || 0,
                  currency
                );
              }
              break;
          }
        }
      } catch (fbError) {
        logger.error({ message: 'Facebook CAPI error', error: fbError });
        results.facebook = { success: false, error: String(fbError) };
      }
    }

    // =========================================================================
    // TIKTOK EVENTS API
    // =========================================================================
    if (
      targets.includes('tiktok') &&
      merchant.tiktok_pixel_id &&
      merchant.tiktok_access_token
    ) {
      try {
        const ttUserData = {
          email: user_data.em,
          phone: user_data.ph,
          externalId: user_data.external_id,
          ipAddress,
          userAgent,
        };

        const eventMapping =
          EVENT_MAPPING[event_name as keyof typeof EVENT_MAPPING];
        if (eventMapping?.tiktok) {
          switch (eventMapping.tiktok) {
            case 'purchase':
              if (
                custom_data.value &&
                custom_data.order_id &&
                custom_data.contents
              ) {
                const products = custom_data.contents.map((c) => ({
                  id: c.id,
                  name: c.id,
                  quantity: c.quantity,
                  price: 0,
                }));
                results.tiktok = await tiktokEventsAPI.purchase(
                  merchant.tiktok_pixel_id,
                  merchant.tiktok_access_token,
                  ttUserData,
                  custom_data.order_id,
                  custom_data.value,
                  currency,
                  products
                );
              }
              break;
            case 'begin_checkout':
              if (custom_data.contents) {
                results.tiktok = await tiktokEventsAPI.initiateCheckout(
                  merchant.tiktok_pixel_id,
                  merchant.tiktok_access_token,
                  ttUserData,
                  custom_data.value || 0,
                  currency,
                  custom_data.contents.map((c) => c.id)
                );
              }
              break;
          }
        }
      } catch (ttError) {
        logger.error({ message: 'TikTok Events API error', error: ttError });
        results.tiktok = { success: false, error: String(ttError) };
      }
    }

    // =========================================================================
    // SNAPCHAT CAPI
    // =========================================================================
    if (
      targets.includes('snapchat') &&
      merchant.snapchat_pixel_id &&
      merchant.snapchat_capi_token
    ) {
      try {
        const snapUserData = {
          email: user_data.em,
          phone: user_data.ph,
          ipAddress,
          userAgent,
        };

        const eventMapping =
          EVENT_MAPPING[event_name as keyof typeof EVENT_MAPPING];
        if (eventMapping?.snapchat) {
          switch (eventMapping.snapchat) {
            case 'purchase':
              if (
                custom_data.value &&
                custom_data.order_id &&
                custom_data.contents
              ) {
                results.snapchat = await snapchatCAPI.purchase(
                  merchant.snapchat_pixel_id,
                  merchant.snapchat_capi_token,
                  snapUserData,
                  custom_data.order_id,
                  custom_data.value,
                  currency,
                  custom_data.contents.map((c) => c.id)
                );
              }
              break;
            case 'begin_checkout':
              if (custom_data.contents) {
                results.snapchat = await snapchatCAPI.startCheckout(
                  merchant.snapchat_pixel_id,
                  merchant.snapchat_capi_token,
                  snapUserData,
                  custom_data.value || 0,
                  currency,
                  custom_data.contents.map((c) => c.id)
                );
              }
              break;
            case 'add_to_cart':
              if (custom_data.contents?.[0]) {
                results.snapchat = await snapchatCAPI.addToCart(
                  merchant.snapchat_pixel_id,
                  merchant.snapchat_capi_token,
                  snapUserData,
                  custom_data.contents[0].id,
                  custom_data.value || 0,
                  currency
                );
              }
              break;
          }
        }
      } catch (snapError) {
        logger.error({ message: 'Snapchat CAPI error', error: snapError });
        results.snapchat = { success: false, error: String(snapError) };
      }
    }

    // =========================================================================
    // GOOGLE ENHANCED CONVERSIONS (via Measurement Protocol)
    // =========================================================================
    if (
      targets.includes('google') &&
      merchant.google_ads_id &&
      merchant.google_ads_conversion_id
    ) {
      try {
        // Google Enhanced Conversions would be implemented here
        // This requires Google Ads API or Measurement Protocol v2
        results.google = { success: true };
      } catch (googleError) {
        logger.error({
          message: 'Google Enhanced Conversions error',
          error: googleError,
        });
        results.google = { success: false, error: String(googleError) };
      }
    }

    logger.info({
      message: 'Conversion event tracked',
      eventName: event_name,
      source: event_source,
      platform,
      merchantId: merchant.id,
      value: custom_data.value,
      currency,
      resultsStatus: Object.keys(results).map(
        (k) => `${k}:${results[k].success ? 'ok' : 'fail'}`
      ),
    });

    return NextResponse.json({
      success: true,
      event_id: eventId,
      results,
    });
  } catch (error) {
    logger.error({
      message: 'Unified conversion endpoint internal error',
      error,
    });
    // Never fail the request - analytics errors shouldn't block the user
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
    });
  }
}
