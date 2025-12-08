import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Lazy initialization to avoid build-time errors
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
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

const EMPTY_CONFIG = {
  google_analytics_id: null,
  facebook_pixel_id: null,
  tiktok_pixel_id: null,
  snapchat_pixel_id: null,
  twitter_pixel_id: null,
};

export async function GET() {
  try {
    // Add a 5-second timeout to prevent server hangs
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), 5000)
    );

    const fetchPromise = getSupabaseAdmin()
      .from('platform_settings')
      .select(
        'google_analytics_id, facebook_pixel_id, tiktok_pixel_id, snapchat_pixel_id, twitter_pixel_id'
      )
      .single();

    const result = await Promise.race([fetchPromise, timeoutPromise]);

    // If timed out, return empty config
    if (result === null) {
      console.warn('Platform analytics config: request timed out, using empty config');
      return NextResponse.json(EMPTY_CONFIG);
    }

    const { data: settings, error } = result;

    if (error) {
      // If no settings exist yet, return empty config
      if (error.code === 'PGRST116') {
        return NextResponse.json(EMPTY_CONFIG);
      }

      console.error('Failed to fetch platform analytics config:', error);
      return NextResponse.json(EMPTY_CONFIG); // Return empty instead of 500 to avoid blocking
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
    // Return empty config instead of 500 to prevent blocking page loads
    return NextResponse.json(EMPTY_CONFIG);
  }
}
