import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type {
  MerchantNotificationFilters,
  MerchantNotificationWithDetails,
} from '@/types/notifications';

/**
 * GET /api/notifications
 * Fetch the current merchant's notifications with cursor-based pagination
 *
 * Query params:
 * - cursor: ISO timestamp string for cursor-based pagination
 * - limit: number (default 20, max 50)
 * - unread_only: boolean
 * - type: NotificationType
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Authentication check
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get merchant
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor');
    const limit = Math.min(
      Number.parseInt(searchParams.get('limit') || '20', 10),
      50
    );
    const unreadOnly = searchParams.get('unread_only') === 'true';
    const type = searchParams.get(
      'type'
    ) as MerchantNotificationFilters['type'];

    // Build query with notification join
    let query = supabase
      .from('merchant_notifications')
      .select(`
        id,
        notification_id,
        merchant_id,
        read_at,
        dismissed_at,
        banner_dismissed_at,
        created_at,
        notification:notifications!inner (
          id,
          title,
          message,
          notification_type,
          priority,
          channels,
          action_url,
          action_label,
          expires_at,
          created_at,
          is_system
        )
      `)
      .eq('merchant_id', merchant.id)
      .is('dismissed_at', null) // Don't show dismissed notifications
      .order('created_at', { ascending: false });

    // Cursor-based pagination (older than cursor)
    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    // Unread filter
    if (unreadOnly) {
      query = query.is('read_at', null);
    }

    // PERFORMANCE: Move type filter to database query
    if (type) {
      query = query.eq('notification.notification_type', type);
    }

    // PERFORMANCE: Filter expired notifications
    // const now = new Date().toISOString();
    // query = query.or(`expires_at.is.null,expires_at.gt.${now}`, {
    //   foreignTable: 'notification',
    // });

    // Alternative approach for expiration check on joined table if the above fails:
    // We can filter in memory or rely on a DB function / view.
    // For now, let's try without the filter to see if 500 resolves.

    // Limit + 1 to check if there are more
    query = query.limit(limit + 1);

    const { data: notifications, error } = await query;

    if (error) {
      console.error('SUPABASE_QUERY_ERROR:', JSON.stringify(error, null, 2));
      return NextResponse.json(
        { error: 'Failed to fetch notifications', details: error.message },
        { status: 500 }
      );
    }

    let filteredNotifications: MerchantNotificationWithDetails[] =
      (notifications || []) as unknown as MerchantNotificationWithDetails[];

    // In-memory filter for expiration (temporary fix/debug)
    const nowTime = new Date().getTime();
    filteredNotifications = filteredNotifications.filter((n) => {
      if (!n.notification.expires_at) return true;
      return new Date(n.notification.expires_at).getTime() > nowTime;
    });

    // Check if there are more results
    const hasMore = filteredNotifications.length > limit;
    if (hasMore) {
      filteredNotifications = filteredNotifications.slice(0, limit);
    }

    // Get cursor for next page
    const nextCursor =
      hasMore && filteredNotifications.length > 0
        ? filteredNotifications[filteredNotifications.length - 1].created_at
        : null;

    // Get unread count
    const { count: unreadCount, error: countError } = await supabase
      .from('merchant_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('merchant_id', merchant.id)
      .is('read_at', null)
      .is('dismissed_at', null);

    if (countError) {
      console.error('COUNT_ERROR:', countError);
    }

    return NextResponse.json({
      data: filteredNotifications,
      cursor: nextCursor,
      has_more: hasMore,
      unread_count: unreadCount || 0,
    });
  } catch (error) {
    console.error('Notifications GET CRITICAL error:', error);
    return NextResponse.json(
      { error: 'Critical failure fetching notifications' },
      { status: 500 }
    );
  }
}
