import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { checkCsrfProtection } from '@/lib/csrf';
import { type ExpoPushMessage, sendPushNotifications } from '@/lib/expo-push';
import { getMerchantForApiRequest } from '@/lib/get-merchant-for-api-request';
import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';
import { createNotificationSchema } from '@/schemas/notifications';
import type {
  AdminNotificationFilters,
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

    // Resolve merchant (supports both owners and staff)
    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // Admin routes require being the merchant owner, not staff
    if (merchantContext.staffAccess.isStaff) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const merchantId = merchantContext.merchantId;

    // Admin role check
    const { data: adminCheck } = await supabase
      .from('merchants')
      .select('is_platform_admin')
      .eq('id', merchantId)
      .maybeSingle();

    if (!adminCheck?.is_platform_admin) {
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
    const cursor = searchParams.get('cursor'); // ISO timestamp for keyset pagination

    // Specific columns matching Notification type (avoids fetching unused data)
    const columns =
      'id, template_id, title, message, notification_type, priority, target_type, target_merchant_ids, target_segment, channels, action_url, action_label, scheduled_for, expires_at, created_by, created_at, sent_at, is_system';

    // Shared filter conditions
    const sanitizedSearch = search ? search.replace(/[%_\\]/g, '\\$&') : null;

    let notifications: Notification[];
    let count: number | null = null;
    let hasMore = false;

    if (cursor) {
      // Keyset pagination — O(1) regardless of page depth
      let q = supabase
        .from('notifications')
        .select(columns)
        .lt('created_at', cursor)
        .order('created_at', { ascending: false })
        .limit(limit + 1);

      if (status === 'sent') q = q.not('sent_at', 'is', null);
      else if (status === 'scheduled')
        q = q.is('sent_at', null).not('scheduled_for', 'is', null);
      else if (status === 'draft')
        q = q.is('sent_at', null).is('scheduled_for', null);
      if (type) q = q.eq('notification_type', type);
      if (priority) q = q.eq('priority', priority);
      if (sanitizedSearch)
        q = q.or(
          `title.ilike.%${sanitizedSearch}%,message.ilike.%${sanitizedSearch}%`
        );

      const { data, error: qError } = await q;
      if (qError) {
        logger.error({
          message: 'Error fetching notifications',
          error: qError,
        });
        return NextResponse.json(
          { error: 'Failed to fetch notifications' },
          { status: 500 }
        );
      }
      const rows = (data ?? []) as Notification[];
      hasMore = rows.length > limit;
      notifications = hasMore ? rows.slice(0, limit) : rows;
    } else {
      // Offset pagination (backward compatible)
      let q = supabase
        .from('notifications')
        .select(columns, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status === 'sent') q = q.not('sent_at', 'is', null);
      else if (status === 'scheduled')
        q = q.is('sent_at', null).not('scheduled_for', 'is', null);
      else if (status === 'draft')
        q = q.is('sent_at', null).is('scheduled_for', null);
      if (type) q = q.eq('notification_type', type);
      if (priority) q = q.eq('priority', priority);
      if (sanitizedSearch)
        q = q.or(
          `title.ilike.%${sanitizedSearch}%,message.ilike.%${sanitizedSearch}%`
        );

      const { data, error: qError, count: totalCount } = await q;
      if (qError) {
        logger.error({
          message: 'Error fetching notifications',
          error: qError,
        });
        return NextResponse.json(
          { error: 'Failed to fetch notifications' },
          { status: 500 }
        );
      }
      notifications = (data ?? []) as Notification[];
      count = totalCount;
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
        logger.warn({
          message:
            'Batch stats RPC unavailable, falling back to individual queries',
          error: batchError,
        });
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
        logger.warn({
          message: 'Batch stats RPC unavailable, proceeding with default stats',
        });
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

    if (cursor) {
      return NextResponse.json({
        data: notificationsWithStats,
        pagination: {
          limit,
          next_cursor: hasMore
            ? notifications[notifications.length - 1].created_at
            : null,
          has_more: hasMore,
        },
      });
    }

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
    logger.error({ message: 'Admin notifications GET internal error', error });
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
    const { valid, response } = await checkCsrfProtection(request);
    if (!valid) {
      return (
        response ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Authentication check
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Resolve merchant (supports both owners and staff)
    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // Admin routes require being the merchant owner, not staff
    if (merchantContext.staffAccess.isStaff) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const merchantId = merchantContext.merchantId;

    // Admin role check
    const { data: adminCheck } = await supabase
      .from('merchants')
      .select('is_platform_admin')
      .eq('id', merchantId)
      .maybeSingle();

    if (!adminCheck?.is_platform_admin) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const parsed = createNotificationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const data = parsed.data;

    // Determine if this should be sent immediately or scheduled
    const scheduledFor = data.scheduled_for
      ? new Date(data.scheduled_for)
      : null;
    const shouldSendImmediately = !scheduledFor || scheduledFor <= new Date();

    // Create the notification
    const { data: notification, error: createError } = await supabase
      .from('notifications')
      .insert({
        title: data.title,
        message: data.message,
        notification_type: data.notification_type,
        priority: data.priority,
        target_type: data.target_type,
        target_merchant_ids: data.target_merchant_ids || [],
        target_segment: data.target_segment || null,
        channels: data.channels,
        action_url: data.action_url ?? null,
        action_label: data.action_label ?? null,
        scheduled_for: shouldSendImmediately
          ? null
          : (data.scheduled_for ?? null),
        expires_at: data.expires_at ?? null,
        template_id: data.template_id ?? null,
        created_by: user.id,
        sent_at: shouldSendImmediately ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (createError) {
      logger.error({
        message: 'Error creating notification',
        error: createError,
      });
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
      if (data.target_type === 'all') {
        // Send to all merchants
        const { data: count, error: rpcError } = await supabase.rpc(
          'send_notification_to_all_merchants',
          { p_notification_id: notification.id }
        );

        if (rpcError) {
          logger.error({
            message: 'Error sending to all merchants',
            error: rpcError,
          });
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
        data.target_type === 'specific' &&
        data.target_merchant_ids?.length
      ) {
        // Send to specific merchants
        const { data: count, error: rpcError } = await supabase.rpc(
          'send_notification_to_merchants',
          {
            p_notification_id: notification.id,
            p_merchant_ids: data.target_merchant_ids,
          }
        );

        if (rpcError) {
          logger.error({
            message: 'Error sending to specific merchants',
            error: rpcError,
          });
        }
        merchantsSent = count || 0;
        broadcastMerchantIds = data.target_merchant_ids ?? [];
      } else if (data.target_type === 'segment' && data.target_segment) {
        // Get merchants in segment and send
        const segmentMerchants = await getSegmentMerchantIds(
          supabase,
          data.target_segment
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
            logger.error({
              message: 'Error sending to segment merchants',
              error: rpcError,
            });
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
    logger.error({ message: 'Admin notifications POST internal error', error });
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
      logger.warn({
        message: 'Broadcast may not have been delivered',
        status: sendResult,
      });
    }

    // Cleanup channel
    await supabase.removeChannel(channel);

    // Send push notifications if the 'push' channel is enabled
    if (notification.channels.includes('push')) {
      await sendPushNotificationsToMerchants(
        notification,
        merchantIds,
        supabase
      );
    }
  } catch (error) {
    // Don't fail the request if broadcast fails
    logger.error({ message: 'Error broadcasting notification', error });
  }
}

/**
 * Send push notifications to all active tokens for the specified merchants
 */
async function sendPushNotificationsToMerchants(
  notification: Notification,
  merchantIds: string[],
  supabase: ReturnType<typeof createClient>
) {
  try {
    // Fetch all active push tokens for the target merchants (admin app only)
    const { data: tokens, error } = await supabase
      .from('push_tokens')
      .select('token, merchant_id')
      .in('merchant_id', merchantIds)
      .eq('is_active', true)
      .eq('app_type', 'admin');

    if (error) {
      logger.error({ message: '[Push] Error fetching push tokens', error });
      return;
    }

    if (!tokens || tokens.length === 0) {
      logger.info({
        message: '[Push] No active push tokens found for target merchants',
      });
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
      priority:
        notification.priority === 'urgent' || notification.priority === 'high'
          ? 'high'
          : 'default',
    }));

    // Send push notifications (batched automatically by expo-push)
    const tickets = await sendPushNotifications(messages);

    // Log results
    const successCount = tickets.filter((t) => t.status === 'ok').length;
    const failCount = tickets.filter((t) => t.status === 'error').length;
    logger.info({
      message: '[Push] Notifications status',
      sent: successCount,
      failed: failCount,
    });

    // Deactivate tokens that are no longer registered
    const tokensToDeactivate = tickets
      .map((ticket, index) =>
        ticket.details?.error === 'DeviceNotRegistered'
          ? tokens[index].token
          : null
      )
      .filter((token): token is string => token !== null);

    if (tokensToDeactivate.length > 0) {
      await supabase
        .from('push_tokens')
        .update({ is_active: false })
        .in('token', tokensToDeactivate);
      logger.info({
        message: '[Push] Deactivated invalid tokens',
        count: tokensToDeactivate.length,
      });
    }
  } catch (error) {
    logger.error({ message: '[Push] Error sending push notifications', error });
  }
}
