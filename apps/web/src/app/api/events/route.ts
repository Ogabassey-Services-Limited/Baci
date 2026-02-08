import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { after, type NextRequest, NextResponse } from 'next/server';
import {
  isConversionEvent,
  normalizeEventType,
  sendToAdPlatforms,
} from '@/lib/analytics/send-to-ad-platforms';

// Lazy-initialize Supabase admin client to avoid build-time errors
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

/**
 * POST /api/events
 *
 * Unified analytics ingestion endpoint. Stores events in the analytics_events
 * table and, for conversion events, fans out to ad platforms via after().
 *
 * Accepts both the original web-storefront format and the mobile conversion
 * format (uppercase event names like START_CHECKOUT are normalized).
 *
 * Recorded events:
 * - Page views
 * - Product views
 * - Add to cart
 * - Remove from cart
 * - Begin checkout
 * - Purchase
 * - Search
 * - Add to wishlist
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      // Core fields
      event_type: rawEventType,
      // Also accept event_name (mobile conversion format)
      event_name: rawEventName,
      merchant_id,
      // Dedup & source
      event_id,
      source,
      // Web storefront fields
      session_id,
      user_agent,
      referrer,
      page_url,
      timestamp,
      // Product-specific fields
      product_id,
      product_name,
      product_category,
      product_price,
      quantity,
      currency,
      // Purchase-specific fields
      order_id,
      total,
      subtotal,
      shipping,
      tax,
      item_count,
      items,
      // Search-specific fields
      search_term,
      results_count,
      // Conversion fields (mobile format)
      user_data,
      custom_data,
    } = body;

    // Resolve event_type: accept either event_type or event_name
    const inputEventType = rawEventType || rawEventName;
    if (!inputEventType || !merchant_id) {
      return NextResponse.json(
        { error: 'Missing required fields: event_type and merchant_id' },
        { status: 400 }
      );
    }

    // Normalize: START_CHECKOUT -> begin_checkout, etc.
    const event_type = normalizeEventType(inputEventType) || inputEventType;

    // Build event_data based on event type
    const event_data: Record<string, unknown> = {
      session_id,
      user_agent,
      referrer,
      page_url,
    };

    // Add event-type specific data
    switch (event_type) {
      case 'product_view':
      case 'add_to_cart':
      case 'remove_from_cart':
      case 'add_to_wishlist':
        Object.assign(event_data, {
          product_id,
          product_name,
          product_category,
          product_price,
          quantity,
          currency,
        });
        break;

      case 'begin_checkout':
      case 'purchase':
        Object.assign(event_data, {
          order_id: order_id || custom_data?.order_id,
          total: total || custom_data?.value,
          subtotal,
          shipping,
          tax,
          currency: currency || custom_data?.currency || 'NGN',
          item_count: item_count || custom_data?.contents?.length,
          items: items || custom_data?.contents,
        });
        break;

      case 'search':
        Object.assign(event_data, {
          search_term,
          results_count,
        });
        break;

      case 'page_view':
        // page_url is already in event_data
        break;

      default:
        // For other conversion events, merge custom_data if present
        if (custom_data) {
          Object.assign(event_data, custom_data);
        }
        break;
    }

    // Remove undefined values
    for (const key of Object.keys(event_data)) {
      if (event_data[key] === undefined) {
        delete event_data[key];
      }
    }

    // Insert into analytics_events table (with dedup via upsert when event_id present)
    if (event_id) {
      const { error } = await getSupabaseAdmin()
        .from('analytics_events')
        .upsert(
          {
            merchant_id,
            event_type,
            event_data,
            event_id,
            source: source || 'web',
            event_timestamp: timestamp || new Date().toISOString(),
          },
          {
            onConflict: 'merchant_id,event_id,event_type',
            ignoreDuplicates: true,
          }
        );

      if (error) {
        console.error('Failed to upsert analytics event:', error);
        return NextResponse.json(
          { error: 'Failed to store event' },
          { status: 500 }
        );
      }
    } else {
      const { error } = await getSupabaseAdmin()
        .from('analytics_events')
        .insert({
          merchant_id,
          event_type,
          event_data,
          source: source || 'web',
          event_timestamp: timestamp || new Date().toISOString(),
        });

      if (error) {
        console.error('Failed to insert analytics event:', error);
        return NextResponse.json(
          { error: 'Failed to store event' },
          { status: 500 }
        );
      }
    }

    // Fan out to ad platforms for conversion events (non-blocking)
    if (isConversionEvent(event_type)) {
      after(async () => {
        try {
          await sendToAdPlatforms({
            merchant_id,
            event_type,
            event_id:
              event_id ||
              `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            user_data: user_data
              ? {
                  email: user_data.em,
                  phone: user_data.ph,
                  external_id: user_data.external_id,
                  ip:
                    request.headers.get('x-forwarded-for')?.split(',')[0] ||
                    request.headers.get('x-real-ip') ||
                    undefined,
                  ua: request.headers.get('user-agent') || undefined,
                }
              : {
                  ip:
                    request.headers.get('x-forwarded-for')?.split(',')[0] ||
                    request.headers.get('x-real-ip') ||
                    undefined,
                  ua: request.headers.get('user-agent') || undefined,
                },
            custom_data: {
              order_id: order_id || custom_data?.order_id,
              value: total || custom_data?.value,
              currency: currency || custom_data?.currency || 'NGN',
              contents: items || custom_data?.contents,
            },
            source: (source as 'web' | 'mobile_app' | 'server') || 'web',
          });
        } catch (err) {
          console.error('CAPI fan-out error (after):', err);
        }
      });
    }

    return NextResponse.json({ success: true, event_id });
  } catch (error) {
    console.error('Event tracking error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
