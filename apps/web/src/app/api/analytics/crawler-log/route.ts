import { createClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * Crawler Log API
 *
 * Logs search engine crawler visits for SEO monitoring.
 * This endpoint is called asynchronously from middleware and should be fast.
 *
 * Data is stored in the crawler_logs table for analysis:
 * - Which pages are being crawled
 * - How often different bots visit
 * - Trends in crawl frequency
 */

// Create a service role client for logging (bypasses RLS)
function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { botName, urlPath, userAgent } = body;

    // Validate required fields
    if (!botName || !urlPath) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();
    if (!supabase) {
      // Silently fail if Supabase not configured - this is non-critical
      return NextResponse.json({ success: true, logged: false });
    }

    // Extract merchant ID from URL path if it's a storefront page
    // Path format: /merchant-slug/... or /merchant-slug
    let merchantId: string | null = null;
    const pathParts = urlPath.split('/').filter(Boolean);

    if (
      pathParts.length > 0 &&
      !['dashboard', 'api', 'auth', 'login', 'onboarding'].includes(
        pathParts[0]
      )
    ) {
      const potentialSlug = pathParts[0];

      // Try to find merchant by slug
      const { data: merchant } = await supabase
        .from('merchants')
        .select('id')
        .eq('slug', potentialSlug)
        .maybeSingle();

      if (merchant) {
        merchantId = merchant.id;
      }
    }

    // Insert crawler log
    const { error } = await supabase.from('crawler_logs').insert({
      bot_name: botName,
      url_path: urlPath.substring(0, 500), // Limit length
      user_agent: userAgent?.substring(0, 500),
      merchant_id: merchantId,
      status_code: 200, // Assume success since middleware passed
    });

    if (error) {
      // Log but don't fail - this is non-critical
      console.error('Failed to log crawler visit:', error.message);
    }

    return NextResponse.json({ success: true, logged: !error });
  } catch (error) {
    // Silently fail - crawler logging should never break the app
    console.error('Crawler log error:', error);
    return NextResponse.json({ success: true, logged: false });
  }
}

// GET endpoint to retrieve crawler stats (for dashboard)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const merchantId = searchParams.get('merchantId');
    const days = Number.parseInt(searchParams.get('days') || '7', 10);

    const supabase = getServiceClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Service unavailable' },
        { status: 503 }
      );
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Build query
    let query = supabase
      .from('crawler_logs')
      .select('bot_name, url_path, crawled_at')
      .gte('crawled_at', startDate.toISOString())
      .order('crawled_at', { ascending: false })
      .limit(1000);

    if (merchantId) {
      query = query.eq('merchant_id', merchantId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Aggregate stats
    const botCounts: Record<string, number> = {};
    const pageCounts: Record<string, number> = {};
    const dailyCounts: Record<string, number> = {};

    for (const log of data || []) {
      // Count by bot
      botCounts[log.bot_name] = (botCounts[log.bot_name] || 0) + 1;

      // Count by page (normalized)
      const normalizedPath = log.url_path.split('?')[0];
      pageCounts[normalizedPath] = (pageCounts[normalizedPath] || 0) + 1;

      // Count by day
      const day = log.crawled_at.split('T')[0];
      dailyCounts[day] = (dailyCounts[day] || 0) + 1;
    }

    return NextResponse.json({
      totalCrawls: data?.length || 0,
      byBot: Object.entries(botCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
      topPages: Object.entries(pageCounts)
        .map(([path, count]) => ({ path, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20),
      byDay: Object.entries(dailyCounts)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    });
  } catch (error) {
    console.error('Crawler stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
