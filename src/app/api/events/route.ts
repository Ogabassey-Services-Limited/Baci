import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy-initialize Supabase admin client to avoid build-time errors
let supabaseAdmin: SupabaseClient | null = null;

function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return supabaseAdmin;
}

/**
 * POST /api/events
 *
 * Receives analytics events from the storefront and stores them in Supabase.
 * This endpoint is used by the event tracking system to record:
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
      event_type,
      merchant_id,
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
    } = body;

    // Validate required fields
    if (!event_type || !merchant_id) {
      return NextResponse.json(
        { error: 'Missing required fields: event_type and merchant_id' },
        { status: 400 }
      );
    }

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
          order_id,
          total,
          subtotal,
          shipping,
          tax,
          currency,
          item_count,
          items,
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
    }

    // Remove undefined values
    Object.keys(event_data).forEach(key => {
      if (event_data[key] === undefined) {
        delete event_data[key];
      }
    });

    // Insert into analytics_events table
    const { error } = await getSupabaseAdmin()
      .from('analytics_events')
      .insert({
        merchant_id,
        event_type,
        event_data,
        event_timestamp: timestamp || new Date().toISOString(),
      });

    if (error) {
      console.error('Failed to insert analytics event:', error);
      return NextResponse.json(
        { error: 'Failed to store event' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Event tracking error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
