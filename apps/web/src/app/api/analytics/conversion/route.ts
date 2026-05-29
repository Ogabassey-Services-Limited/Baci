import {
  createClient as createSupabaseDirectClient,
  type SupabaseClient,
} from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import {
  type AdPlatformTarget,
  normalizeEventType,
  sendToAdPlatforms,
} from '@/lib/analytics/send-to-ad-platforms';
import { generateEventId } from '@/lib/facebook-capi';
import { logger } from '@/lib/logger';

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
    fbc?: string;
    fbp?: string;
    fn?: string; // first name
    ln?: string; // last name
    sccid?: string;
    ttclid?: string;
    ttp?: string;
  };
  custom_data: {
    order_id?: string;
    value?: number;
    currency?: string;
    content_name?: string;
    content_type?: 'product' | 'product_group';
    price?: number;
    search_string?: string;
    url?: string;
    contents?: Array<{
      id: string;
      quantity: number;
      name?: string;
      price?: number;
    }>;
  };
  targets?: AdPlatformTarget[];
}

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
}

const MERCHANT_SELECT = 'id';

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

    // Get IP and user agent from request
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      undefined;
    const userAgent = request.headers.get('user-agent') || undefined;

    const currency = custom_data.currency || 'NGN';
    const dbEventType = normalizeEventType(event_name);
    const results = dbEventType
      ? await sendToAdPlatforms({
          merchant_id: merchant.id,
          event_type: dbEventType,
          event_id: eventId,
          user_data: {
            email: user_data.em,
            phone: user_data.ph,
            external_id: user_data.external_id,
            fbc: user_data.fbc,
            fbp: user_data.fbp,
            ip: ipAddress,
            sccid: user_data.sccid,
            ttclid: user_data.ttclid,
            ttp: user_data.ttp,
            ua: userAgent,
          },
          custom_data: {
            order_id: custom_data.order_id,
            value: custom_data.value,
            currency,
            content_name: custom_data.content_name,
            content_type: custom_data.content_type,
            contents: custom_data.contents,
            price: custom_data.price,
            search_string: custom_data.search_string,
            url: custom_data.url,
          },
          source: event_source || 'server',
          targets,
        })
      : {};

    logger.info({
      message: 'Conversion event tracked',
      eventName: event_name,
      source: event_source,
      platform,
      merchantId: merchant.id,
      value: custom_data.value,
      currency,
      resultsStatus: Object.entries(results).map(
        ([key, result]) => `${key}:${result.success ? 'ok' : 'fail'}`
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
