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
        notification:notifications (
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

    // Limit + 1 to check if there are more
    query = query.limit(limit + 1);

    const { data: notifications, error } = await query;

    if (error) {
      console.error('Error fetching notifications:', error);
      return NextResponse.json(
        { error: 'Failed to fetch notifications' },
        { status: 500 }
      );
    }

    // Filter by notification type if specified
    let filteredNotifications: MerchantNotificationWithDetails[] =
      (notifications || []) as unknown as MerchantNotificationWithDetails[];
    if (type) {
      filteredNotifications = filteredNotifications.filter(
        (n) => n.notification?.notification_type === type
      );
    }

    // Filter out expired notifications
    const now = new Date();
    filteredNotifications = filteredNotifications.filter(
      (n) =>
        !n.notification?.expires_at || new Date(n.notification.expires_at) > now
    );

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
    const { count: unreadCount } = await supabase
      .from('merchant_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('merchant_id', merchant.id)
      .is('read_at', null)
      .is('dismissed_at', null);

    return NextResponse.json({
      data: filteredNotifications,
      cursor: nextCursor,
      has_more: hasMore,
      unread_count: unreadCount || 0,
    });
  } catch (error) {
    console.error('Notifications GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}
