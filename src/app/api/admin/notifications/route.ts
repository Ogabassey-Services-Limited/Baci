import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import type {
  CreateNotificationInput,
  Notification,
  NotificationWithStats,
  AdminNotificationFilters,
} from '@/types/notifications';

/**
 * GET /api/admin/notifications
 * List all notifications with pagination and filters
 * Only accessible to platform administrators
 *
 * Query params:
 * - status: 'all' | 'sent' | 'scheduled' | 'draft'
 * - type: NotificationType
 * - priority: NotificationPriority
 * - search: string (searches title and message)
 * - limit: number (default 20)
 * - offset: number (default 0)
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Authentication check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin role check
    const { data: merchant } = await supabase
      .from('merchants')
      .select('is_platform_admin')
      .eq('user_id', user.id)
      .single();

    if (!merchant?.is_platform_admin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as AdminNotificationFilters['status'] || 'all';
    const type = searchParams.get('type') as AdminNotificationFilters['type'];
    const priority = searchParams.get('priority') as AdminNotificationFilters['priority'];
    const search = searchParams.get('search');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    let query = supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    // Status filter
    if (status === 'sent') {
      query = query.not('sent_at', 'is', null);
    } else if (status === 'scheduled') {
      query = query.is('sent_at', null).not('scheduled_for', 'is', null);
    } else if (status === 'draft') {
      query = query.is('sent_at', null).is('scheduled_for', null);
    }

    // Type filter
    if (type) {
      query = query.eq('notification_type', type);
    }

    // Priority filter
    if (priority) {
      query = query.eq('priority', priority);
    }

    // Search filter
    if (search) {
      query = query.or(`title.ilike.%${search}%,message.ilike.%${search}%`);
    }

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data: notifications, error, count } = await query;

    if (error) {
      console.error('Error fetching notifications:', error);
      return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
    }

    // Fetch stats for each notification
    const notificationsWithStats: NotificationWithStats[] = await Promise.all(
      (notifications || []).map(async (notification: Notification) => {
        const { data: stats } = await supabase
          .rpc('get_notification_stats', { p_notification_id: notification.id });

        return {
          ...notification,
          stats: stats?.[0] || {
            total_sent: 0,
            total_read: 0,
            total_dismissed: 0,
            read_rate: 0,
          },
        };
      })
    );

    return NextResponse.json({
      data: notificationsWithStats,
      pagination: {
        total: count || 0,
        limit,
        offset,
        has_more: (count || 0) > offset + limit,
      },
    });
  } catch (error) {
    console.error('Admin notifications GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/notifications
 * Create a new notification
 * Only accessible to platform administrators
 *
 * If scheduled_for is not provided or is in the past, the notification is sent immediately.
 * Otherwise, it's scheduled for future delivery.
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Authentication check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin role check
    const { data: merchant } = await supabase
      .from('merchants')
      .select('is_platform_admin')
      .eq('user_id', user.id)
      .single();

    if (!merchant?.is_platform_admin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    // Parse and validate request body
    const body: CreateNotificationInput = await request.json();

    // Validation
    if (!body.title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }
    if (!body.message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }
    if (!body.channels?.length) {
      return NextResponse.json({ error: 'At least one channel is required' }, { status: 400 });
    }
    if (body.target_type === 'specific' && (!body.target_merchant_ids?.length)) {
      return NextResponse.json({ error: 'Target merchant IDs required for specific targeting' }, { status: 400 });
    }
    if (body.target_type === 'segment' && !body.target_segment) {
      return NextResponse.json({ error: 'Target segment required for segment targeting' }, { status: 400 });
    }

    // Determine if this should be sent immediately or scheduled
    const scheduledFor = body.scheduled_for ? new Date(body.scheduled_for) : null;
    const shouldSendImmediately = !scheduledFor || scheduledFor <= new Date();

    // Create the notification
    const { data: notification, error: createError } = await supabase
      .from('notifications')
      .insert({
        title: body.title.trim(),
        message: body.message.trim(),
        notification_type: body.notification_type || 'info',
        priority: body.priority || 'normal',
        target_type: body.target_type || 'all',
        target_merchant_ids: body.target_merchant_ids || [],
        target_segment: body.target_segment || null,
        channels: body.channels,
        action_url: body.action_url || null,
        action_label: body.action_label || null,
        scheduled_for: shouldSendImmediately ? null : body.scheduled_for,
        expires_at: body.expires_at || null,
        template_id: body.template_id || null,
        created_by: user.id,
        sent_at: shouldSendImmediately ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating notification:', createError);
      return NextResponse.json({ error: 'Failed to create notification' }, { status: 500 });
    }

    // If sending immediately, create merchant_notifications and broadcast
    if (shouldSendImmediately && notification) {
      let merchantsSent = 0;

      if (body.target_type === 'all') {
        // Send to all merchants
        const { data: count } = await supabase
          .rpc('send_notification_to_all_merchants', { p_notification_id: notification.id });
        merchantsSent = count || 0;
      } else if (body.target_type === 'specific' && body.target_merchant_ids?.length) {
        // Send to specific merchants
        const { data: count } = await supabase
          .rpc('send_notification_to_merchants', {
            p_notification_id: notification.id,
            p_merchant_ids: body.target_merchant_ids,
          });
        merchantsSent = count || 0;
      } else if (body.target_type === 'segment' && body.target_segment) {
        // Get merchants in segment and send
        const segmentMerchants = await getSegmentMerchantIds(supabase, body.target_segment);
        if (segmentMerchants.length > 0) {
          const { data: count } = await supabase
            .rpc('send_notification_to_merchants', {
              p_notification_id: notification.id,
              p_merchant_ids: segmentMerchants,
            });
          merchantsSent = count || 0;
        }
      }

      // Broadcast to connected clients via Supabase Realtime
      // This is done by creating a broadcast message on the notification channel
      await broadcastNotification(supabase, notification, body.target_type, body.target_merchant_ids, body.target_segment);

      return NextResponse.json({
        notification,
        status: 'sent',
        merchants_notified: merchantsSent,
      }, { status: 201 });
    }

    return NextResponse.json({
      notification,
      status: 'scheduled',
      scheduled_for: notification.scheduled_for,
    }, { status: 201 });
  } catch (error) {
    console.error('Admin notifications POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create notification' },
      { status: 500 }
    );
  }
}

/**
 * Get merchant IDs for a specific segment
 */
async function getSegmentMerchantIds(
  supabase: ReturnType<typeof createClient>,
  segment: string
): Promise<string[]> {
  // This uses the merchant_health view which should have health_status
  // Segments: 'new', 'active', 'at_risk'
  let query = supabase.from('merchants').select('id');

  switch (segment) {
    case 'new': {
      // Merchants created in the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      query = query.gte('created_at', thirtyDaysAgo.toISOString());
      break;
    }
    case 'active':
      // Merchants with orders in the last 30 days (simplified)
      // In production, you'd join with orders or use the health view
      query = query.not('user_id', 'is', null);
      break;
    case 'at_risk':
      // This would ideally use the merchant_health view
      // For now, just return merchants without recent orders
      // In production, you'd have more sophisticated logic
      query = query.not('user_id', 'is', null);
      break;
  }

  const { data } = await query;
  return (data || []).map((m: { id: string }) => m.id);
}

/**
 * Broadcast notification to connected merchants via Supabase Realtime
 */
async function broadcastNotification(
  supabase: ReturnType<typeof createClient>,
  notification: Notification,
  targetType: string,
  targetMerchantIds?: string[],
  targetSegment?: string
) {
  try {
    // Get list of merchant IDs to notify
    let merchantIds: string[] = [];

    if (targetType === 'all') {
      const { data } = await supabase
        .from('merchants')
        .select('id')
        .not('user_id', 'is', null);
      merchantIds = (data || []).map((m: { id: string }) => m.id);
    } else if (targetType === 'specific' && targetMerchantIds) {
      merchantIds = targetMerchantIds;
    } else if (targetType === 'segment' && targetSegment) {
      merchantIds = await getSegmentMerchantIds(supabase, targetSegment);
    }

    // Broadcast to each merchant's private channel
    // Note: In production with many merchants, you might want to batch this
    // or use a server-side broadcast mechanism
    const broadcastPayload = {
      event: 'new_notification',
      notification: {
        id: notification.id,
        title: notification.title,
        message: notification.message,
        notification_type: notification.notification_type,
        priority: notification.priority,
        channels: notification.channels,
        action_url: notification.action_url,
        action_label: notification.action_label,
      },
      created_at: notification.created_at,
    };

    // For simplicity, we broadcast to a global notifications channel
    // Individual merchants subscribe to this and filter by their ID
    // In production, you might use per-merchant channels for better isolation
    const channel = supabase.channel('notifications:global');

    await channel.send({
      type: 'broadcast',
      event: 'new_notification',
      payload: {
        ...broadcastPayload,
        target_merchant_ids: merchantIds,
      },
    });

    // Cleanup channel
    await supabase.removeChannel(channel);
  } catch (error) {
    // Don't fail the request if broadcast fails
    console.error('Error broadcasting notification:', error);
  }
}
