import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Lazy initialization to avoid build-time errors
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Platform Analytics Config API
 *
 * GET - Returns platform analytics pixel IDs (public, no secrets)
 *
 * This endpoint is called by the PlatformAnalyticsProvider to load
 * the platform owner's analytics pixels on public pages.
 */

export async function GET() {
  try {
    // Get platform settings (only analytics IDs, no secrets)
    const { data: settings, error } = await getSupabaseAdmin()
      .from('platform_settings')
      .select(
        'google_analytics_id, facebook_pixel_id, tiktok_pixel_id, snapchat_pixel_id, twitter_pixel_id'
      )
      .single();

    if (error) {
      // If no settings exist yet, return empty config
      if (error.code === 'PGRST116') {
        return NextResponse.json({
          google_analytics_id: null,
          facebook_pixel_id: null,
          tiktok_pixel_id: null,
          snapchat_pixel_id: null,
          twitter_pixel_id: null,
        });
      }

      console.error('Failed to fetch platform analytics config:', error);
      return NextResponse.json(
        { error: 'Failed to fetch config' },
        { status: 500 }
      );
    }

    // Return only pixel IDs (no API secrets or tokens)
    return NextResponse.json({
      google_analytics_id: settings.google_analytics_id || null,
      facebook_pixel_id: settings.facebook_pixel_id || null,
      tiktok_pixel_id: settings.tiktok_pixel_id || null,
      snapchat_pixel_id: settings.snapchat_pixel_id || null,
      twitter_pixel_id: settings.twitter_pixel_id || null,
    });
  } catch (error) {
    console.error('Platform analytics config error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
