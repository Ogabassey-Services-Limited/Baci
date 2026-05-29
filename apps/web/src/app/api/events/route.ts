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

    // Build event_data using only known, safe property names (whitelist)
    // This prevents remote property injection from user-controlled keys
    const cleanedEventData: Record<string, unknown> = {};

    // Base fields (always present)
    if (session_id !== undefined) cleanedEventData.session_id = session_id;
    if (user_agent !== undefined) cleanedEventData.user_agent = user_agent;
    if (referrer !== undefined) cleanedEventData.referrer = referrer;
    if (page_url !== undefined) cleanedEventData.page_url = page_url;

    // Add event-type specific data using only known property names
    switch (event_type) {
      case 'product_view':
      case 'add_to_cart':
      case 'remove_from_cart':
      case 'add_to_wishlist':
        if (product_id !== undefined) cleanedEventData.product_id = product_id;
        if (product_name !== undefined)
          cleanedEventData.product_name = product_name;
        if (product_category !== undefined)
          cleanedEventData.product_category = product_category;
        if (product_price !== undefined)
          cleanedEventData.product_price = product_price;
        if (quantity !== undefined) cleanedEventData.quantity = quantity;
        if (currency !== undefined) cleanedEventData.currency = currency;
        break;

      case 'begin_checkout':
      case 'purchase': {
        const resolvedOrderId = order_id || custom_data?.order_id;
        const resolvedTotal = total || custom_data?.value;
        const resolvedItemCount = item_count || custom_data?.contents?.length;
        const resolvedItems = items || custom_data?.contents;
        if (resolvedOrderId !== undefined)
          cleanedEventData.order_id = resolvedOrderId;
        if (resolvedTotal !== undefined) cleanedEventData.total = resolvedTotal;
        if (subtotal !== undefined) cleanedEventData.subtotal = subtotal;
        if (shipping !== undefined) cleanedEventData.shipping = shipping;
        if (tax !== undefined) cleanedEventData.tax = tax;
        cleanedEventData.currency = currency || custom_data?.currency || 'NGN';
        if (resolvedItemCount !== undefined)
          cleanedEventData.item_count = resolvedItemCount;
        if (resolvedItems !== undefined) cleanedEventData.items = resolvedItems;
        break;
      }

      case 'search':
        if (search_term !== undefined)
          cleanedEventData.search_term = search_term;
        if (results_count !== undefined)
          cleanedEventData.results_count = results_count;
        break;

      case 'page_view':
        // page_url is already set above
        break;

      default:
        // For other conversion events, store custom_data as a nested object
        // under a fixed key (never spread user-controlled keys as properties)
        if (custom_data) {
          cleanedEventData.custom_data = custom_data;
        }
        break;
    }

    // Insert into analytics_events table (with dedup via upsert when event_id present)
    if (event_id) {
      const { error } = await getSupabaseAdmin()
        .from('analytics_events')
        .upsert(
          {
            merchant_id,
            event_type,
            event_data: cleanedEventData,
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
          event_data: cleanedEventData,
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
          const resolvedContents =
            items ||
            custom_data?.contents ||
            (product_id
              ? [
                  {
                    id: product_id,
                    name: product_name,
                    price: product_price,
                    quantity: quantity || 1,
                  },
                ]
              : undefined);
          const resolvedValue =
            total || custom_data?.value || product_price || undefined;

          await sendToAdPlatforms({
            merchant_id,
            event_type,
            event_id:
              event_id ||
              `evt_${Date.now()}_${crypto.randomUUID().replace(/-/g, '')}`,
            user_data: user_data
              ? {
                  email: user_data.em,
                  phone: user_data.ph,
                  external_id: user_data.external_id,
                  fbc: user_data.fbc || request.cookies.get('_fbc')?.value,
                  fbp: user_data.fbp || request.cookies.get('_fbp')?.value,
                  ip:
                    request.headers.get('x-forwarded-for')?.split(',')[0] ||
                    request.headers.get('x-real-ip') ||
                    undefined,
                  sccid: user_data.sccid || request.cookies.get('ScCid')?.value,
                  ttclid: user_data.ttclid,
                  ttp: user_data.ttp || request.cookies.get('_ttp')?.value,
                  ua: request.headers.get('user-agent') || undefined,
                }
              : {
                  fbc: request.cookies.get('_fbc')?.value,
                  fbp: request.cookies.get('_fbp')?.value,
                  ip:
                    request.headers.get('x-forwarded-for')?.split(',')[0] ||
                    request.headers.get('x-real-ip') ||
                    undefined,
                  sccid: request.cookies.get('ScCid')?.value,
                  ttp: request.cookies.get('_ttp')?.value,
                  ua: request.headers.get('user-agent') || undefined,
                },
            custom_data: {
              order_id: order_id || custom_data?.order_id,
              value: resolvedValue,
              currency: currency || custom_data?.currency || 'NGN',
              content_name: product_name || custom_data?.content_name,
              content_type: custom_data?.content_type || 'product',
              contents: resolvedContents,
              price: product_price || custom_data?.price,
              search_string: search_term || custom_data?.search_string,
              url: page_url || custom_data?.url,
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
