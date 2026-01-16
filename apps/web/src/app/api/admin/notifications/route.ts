import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendPushNotifications, type ExpoPushMessage } from '@/lib/expo-push';
import type {
  AdminNotificationFilters,
  CreateNotificationInput,
  Notification,
  NotificationWithStats,
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
    const {
      data: { user },
    } = await supabase.auth.getUser();
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
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const status =
      (searchParams.get('status') as AdminNotificationFilters['status']) ||
      'all';
    const type = searchParams.get('type') as AdminNotificationFilters['type'];
    const priority = searchParams.get(
      'priority'
    ) as AdminNotificationFilters['priority'];
    const search = searchParams.get('search');
    const limit = Math.min(
      Number.parseInt(searchParams.get('limit') || '20', 10) || 20,
      100
    );
    const offset = Number.parseInt(searchParams.get('offset') || '0', 10) || 0;

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
      // Escape special characters for LIKE pattern
      const sanitizedSearch = search.replace(/[%_\\]/g, '\\$&');
      query = query.or(
        `title.ilike.%${sanitizedSearch}%,message.ilike.%${sanitizedSearch}%`
      );
    }

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data: notifications, error, count } = await query;

    if (error) {
      console.error('Error fetching notifications:', error);
      return NextResponse.json(
        { error: 'Failed to fetch notifications' },
        { status: 500 }
      );
    }

    // Fetch stats for all notifications in a single batch query
    // This avoids N+1 query pattern where each notification triggers separate RPC call
    const notificationIds = (notifications || []).map(
      (n: Notification) => n.id
    );

    let statsMap = new Map<
      string,
      {
        total_sent: number;
        total_read: number;
        total_dismissed: number;
        read_rate: number;
      }
    >();

    if (notificationIds.length > 0) {
      // Try batch stats fetch first, fallback to individual if not available
      const { data: batchStats, error: batchError } = await supabase.rpc(
        'get_notification_stats_batch',
        { p_notification_ids: notificationIds }
      );

      if (batchError) {
        console.warn(
          'Batch stats RPC unavailable, falling back to individual queries:',
          batchError.message
        );
      }

      if (batchStats && Array.isArray(batchStats)) {
        statsMap = new Map(
          batchStats.map(
            (s: {
              notification_id: string;
              total_sent: number;
              total_read: number;
              total_dismissed: number;
              read_rate: number;
            }) => [s.notification_id, s]
          )
        );
      } else {
        // If batch function is unavailable, stats will be missing for notifications.
        // Instead of performing N+1 individual queries, we'll proceed with default stats.
        console.warn(
          'Batch stats RPC unavailable, proceeding with default stats'
        );
        statsMap = new Map();
      }
    }

    const notificationsWithStats: NotificationWithStats[] = (
      notifications || []
    ).map((notification: Notification) => ({
      ...notification,
      stats: statsMap.get(notification.id) || {
        total_sent: 0,
        total_read: 0,
        total_dismissed: 0,
        read_rate: 0,
      },
    }));

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
    const {
      data: { user },
    } = await supabase.auth.getUser();
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
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    let body: CreateNotificationInput;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // Validation
    if (!body.title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }
    if (!body.message?.trim()) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }
    if (!body.channels?.length) {
      return NextResponse.json(
        { error: 'At least one channel is required' },
        { status: 400 }
      );
    }
    if (body.target_type === 'specific' && !body.target_merchant_ids?.length) {
      return NextResponse.json(
        { error: 'Target merchant IDs required for specific targeting' },
        { status: 400 }
      );
    }
    if (body.target_type === 'segment' && !body.target_segment) {
      return NextResponse.json(
        { error: 'Target segment required for segment targeting' },
        { status: 400 }
      );
    }

    // Determine if this should be sent immediately or scheduled
    const scheduledFor = body.scheduled_for
      ? new Date(body.scheduled_for)
      : null;
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
      return NextResponse.json(
        { error: 'Failed to create notification' },
        { status: 500 }
      );
    }

    // If sending immediately, create merchant_notifications and broadcast
    if (shouldSendImmediately && notification) {
      let merchantsSent = 0;

      // Fetch merchant IDs for broadcast if not already available
      let broadcastMerchantIds: string[] = [];
      if (body.target_type === 'all') {
        // Send to all merchants
        const { data: count, error: rpcError } = await supabase.rpc(
          'send_notification_to_all_merchants',
          { p_notification_id: notification.id }
        );

        if (rpcError) {
          console.error('Error sending to all merchants:', rpcError);
          // Mark notification as failed in the database for consistency
          await supabase
            .from('notifications')
            .update({ status: 'failed' })
            .eq('id', notification.id);
          return NextResponse.json(
            {
              error: 'Failed to send notification to all merchants',
              notification_id: notification.id,
            },
            { status: 500 }
          );
        }
        merchantsSent = count || 0;

        // Fetch IDs for broadcast
        const { data: allMerchants } = await supabase
          .from('merchants')
          .select('id')
          .not('user_id', 'is', null);
        broadcastMerchantIds = (allMerchants || []).map(
          (m: { id: string }) => m.id
        );
      } else if (
        body.target_type === 'specific' &&
        body.target_merchant_ids?.length
      ) {
        // Send to specific merchants
        const { data: count, error: rpcError } = await supabase.rpc(
          'send_notification_to_merchants',
          {
            p_notification_id: notification.id,
            p_merchant_ids: body.target_merchant_ids,
          }
        );

        if (rpcError) {
          console.error('Error sending to specific merchants:', rpcError);
        }
        merchantsSent = count || 0;
        broadcastMerchantIds = body.target_merchant_ids;
      } else if (body.target_type === 'segment' && body.target_segment) {
        // Get merchants in segment and send
        const segmentMerchants = await getSegmentMerchantIds(
          supabase,
          body.target_segment
        );
        if (segmentMerchants.length > 0) {
          const { data: count, error: rpcError } = await supabase.rpc(
            'send_notification_to_merchants',
            {
              p_notification_id: notification.id,
              p_merchant_ids: segmentMerchants,
            }
          );

          if (rpcError) {
            console.error('Error sending to segment merchants:', rpcError);
          }
          merchantsSent = count || 0;
          broadcastMerchantIds = segmentMerchants;
        }
      }

      // Broadcast to connected clients via Supabase Realtime
      // This is done by creating a broadcast message on the notification channel
      await broadcastNotification(supabase, notification, broadcastMerchantIds);

      return NextResponse.json(
        {
          notification,
          status: 'sent',
          merchants_notified: merchantsSent,
        },
        { status: 201 }
      );
    }

    return NextResponse.json(
      {
        notification,
        status: 'scheduled',
        scheduled_for: notification.scheduled_for,
      },
      { status: 201 }
    );
  } catch (error) {
    // Safe error logging
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      'Admin notifications POST error:',
      errorMessage.replace(/[\r\n]/g, ' ')
    );
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
      // TODO: Implement proper active merchant logic using merchant_health view
      throw new Error('Segment "active" is not yet implemented');
    case 'at_risk':
      // TODO: Implement proper at-risk merchant logic using merchant_health view
      throw new Error('Segment "at_risk" is not yet implemented');
    default:
      // Reject unknown segments explicitly
      throw new Error(`Unknown segment "${segment}" requested`);
  }

  const { data } = await query;
  return (data || []).map((m: { id: string }) => m.id);
}

/**
 * Broadcast notification to connected merchants via Supabase Realtime
 * Also sends push notifications if the 'push' channel is enabled
 */
async function broadcastNotification(
  supabase: ReturnType<typeof createClient>,
  notification: Notification,
  merchantIds: string[]
) {
  try {
    if (merchantIds.length === 0) return;

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

    const sendResult = await channel.send({
      type: 'broadcast',
      event: 'new_notification',
      payload: {
        ...broadcastPayload,
        target_merchant_ids: merchantIds,
      },
    });

    if (sendResult !== 'ok') {
      console.warn('Broadcast may not have been delivered:', sendResult);
    }

    // Cleanup channel
    await supabase.removeChannel(channel);

    // Send push notifications if the 'push' channel is enabled
    if (notification.channels.includes('push')) {
      await sendPushNotificationsToMerchants(notification, merchantIds);
    }
  } catch (error) {
    // Don't fail the request if broadcast fails
    console.error('Error broadcasting notification:', error);
  }
}

/**
 * Send push notifications to all active tokens for the specified merchants
 */
async function sendPushNotificationsToMerchants(
  notification: Notification,
  merchantIds: string[]
) {
  try {
    const adminSupabase = createAdminClient();

    // Fetch all active push tokens for the target merchants (admin app only)
    const { data: tokens, error } = await adminSupabase
      .from('push_tokens')
      .select('token, merchant_id')
      .in('merchant_id', merchantIds)
      .eq('is_active', true)
      .eq('app_type', 'admin');

    if (error) {
      console.error('[Push] Error fetching push tokens:', error);
      return;
    }

    if (!tokens || tokens.length === 0) {
      console.log('[Push] No active push tokens found for target merchants');
      return;
    }

    // Build push messages
    const messages: ExpoPushMessage[] = tokens.map((t) => ({
      to: t.token,
      title: notification.title,
      body: notification.message,
      data: {
        type: 'admin_broadcast',
        notification_id: notification.id,
        action_url: notification.action_url,
      },
      sound: 'default',
      channelId: 'admin', // Android notification channel
      priority: notification.priority === 'urgent' || notification.priority === 'high' ? 'high' : 'default',
    }));

    // Send push notifications (batched automatically by expo-push)
    const tickets = await sendPushNotifications(messages);

    // Log results
    const successCount = tickets.filter((t) => t.status === 'ok').length;
    const failCount = tickets.filter((t) => t.status === 'error').length;
    console.log(`[Push] Sent ${successCount} push notifications (${failCount} failed)`);

    // Deactivate tokens that are no longer registered
    const tokensToDeactivate = tickets
      .map((ticket, index) =>
        ticket.details?.error === 'DeviceNotRegistered' ? tokens[index].token : null
      )
      .filter((token): token is string => token !== null);

    if (tokensToDeactivate.length > 0) {
      await adminSupabase
        .from('push_tokens')
        .update({ is_active: false })
        .in('token', tokensToDeactivate);
      console.log(`[Push] Deactivated ${tokensToDeactivate.length} invalid tokens`);
    }
  } catch (error) {
    console.error('[Push] Error sending push notifications:', error);
  }
}
