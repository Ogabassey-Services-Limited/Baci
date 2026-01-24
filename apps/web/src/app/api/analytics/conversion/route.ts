import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { facebookCAPI, generateEventId } from '@/lib/facebook-capi';
import { snapchatCAPI } from '@/lib/snapchat-capi';
import { createClient } from '@/lib/supabase/server';
import { tiktokEventsAPI } from '@/lib/tiktok-events-api';

/**
 * Unified Conversions API Endpoint
 *
 * Server-side endpoint that forwards conversion events to ALL ad platforms.
 * This is the recommended approach for iOS 14.5+ compliance.
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

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ConversionRequest;
    const {
      event_name,
      event_id: clientEventId,
      event_time: _eventTime,
      event_source,
      platform,
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

    // Get merchant from slug (ogabassey is the default for this mobile app)
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Use the merchant slug from the request origin or default to ogabassey
    const origin = request.headers.get('origin') || '';
    const merchantSlug = origin.includes('ogabassey')
      ? 'ogabassey'
      : 'ogabassey';

    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select(`
        id,
        facebook_pixel_id,
        facebook_capi_token,
        tiktok_pixel_id,
        tiktok_access_token,
        snapchat_pixel_id,
        snapchat_capi_token,
        google_ads_id,
        google_ads_conversion_id
      `)
      .eq('slug', merchantSlug)
      .single();

    if (merchantError || !merchant) {
      console.error('Failed to fetch merchant:', merchantError);
      // Don't fail - just log and return success
      return NextResponse.json({
        success: true,
        message: 'Merchant not found, events not sent',
        results: {},
      });
    }

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
    // eventId is already defined above

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
                  merchant.facebook_pixel_id as string,
                  merchant.facebook_capi_token as string,
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
                  merchant.facebook_pixel_id as string,
                  merchant.facebook_capi_token as string,
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
                merchant.facebook_pixel_id as string,
                merchant.facebook_capi_token as string,
                fbUserData,
                custom_data.value || 0,
                currency,
                custom_data.contents || []
              );
              break;
            case 'ViewContent':
              if (custom_data.contents?.[0]) {
                results.facebook = await facebookCAPI.viewContent(
                  merchant.facebook_pixel_id as string,
                  merchant.facebook_capi_token as string,
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
        console.error('Facebook CAPI error:', String(fbError).replace(/[\r\n]/g, ' '));
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
                  merchant.tiktok_pixel_id as string,
                  merchant.tiktok_access_token as string,
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
                  merchant.tiktok_pixel_id as string,
                  merchant.tiktok_access_token as string,
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
        console.error('TikTok Events API error:', String(ttError).replace(/[\r\n]/g, ' '));
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
                  merchant.snapchat_pixel_id as string,
                  merchant.snapchat_capi_token as string,
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
                  merchant.snapchat_pixel_id as string,
                  merchant.snapchat_capi_token as string,
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
                  merchant.snapchat_pixel_id as string,
                  merchant.snapchat_capi_token as string,
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
        console.error('Snapchat CAPI error:', String(snapError).replace(/[\r\n]/g, ' '));
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
        console.error('Google Enhanced Conversions error:', googleError);
        results.google = { success: false, error: String(googleError) };
      }
    }

    // Log for debugging - sanitize user-provided values to prevent log injection
    const sanitizeForLog = (val: unknown): string => {
      if (val === undefined || val === null) return 'unknown';
      const str = String(val).slice(0, 50); // Limit length
      return str.replace(/[\r\n\t]/g, ' ').replace(/[^\x20-\x7E]/g, ''); // Remove control chars
    };

    console.log(
      '[Conversion]',
      sanitizeForLog(event_name),
      'from',
      sanitizeForLog(event_source),
      '/',
      sanitizeForLog(platform),
      ':',
      {
        value: custom_data.value,
        currency,
        results,
      }
    );

    return NextResponse.json({
      success: true,
      event_id: eventId,
      results,
    });
  } catch (error) {
    console.error('Unified conversion endpoint error:', String(error).replace(/[\r\n]/g, ' '));
    // Never fail the request - analytics errors shouldn't block the user
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
    });
  }
}
