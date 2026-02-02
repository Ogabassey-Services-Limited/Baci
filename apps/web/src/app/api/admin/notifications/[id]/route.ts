import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';
import { notificationIdSchema } from '@/schemas/notifications';
import type {
  NotificationWithStats,
  UpdateNotificationInput,
} from '@/types/notifications';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/notifications/[id]
 * Get a specific notification with delivery stats
 * Only accessible to platform administrators
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Validate ID as a UUID
    const validation = notificationIdSchema.safeParse(id);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid notification ID format' },
        { status: 400 }
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

    // Fetch notification with delivery stats
    const { data: notification, error: fetchError } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !notification) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    // Get stats
    const { count: totalRecipients } = await supabase
      .from('merchant_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('notification_id', id);

    const { count: readCount } = await supabase
      .from('merchant_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('notification_id', id)
      .not('read_at', 'is', null);

    const notificationWithStats: NotificationWithStats = {
      ...notification,
      stats: {
        total_recipients: totalRecipients || 0,
        read_count: readCount || 0,
      },
    };

    return NextResponse.json(notificationWithStats);
  } catch (error) {
    logger.error({ message: 'Admin notification GET error', error });
    return NextResponse.json(
      { error: 'Failed to fetch notification' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/notifications/[id]
 * Update a scheduled notification (only before it's sent)
 * Only accessible to platform administrators
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Validate ID as a UUID
    const validation = notificationIdSchema.safeParse(id);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid notification ID format' },
        { status: 400 }
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

    // Check if notification exists and hasn't been sent
    const { data: existing, error: fetchError } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    if (existing.sent_at) {
      return NextResponse.json(
        { error: 'Cannot update a notification that has already been sent' },
        { status: 400 }
      );
    }

    // Parse and validate request body
    const body: UpdateNotificationInput = await request.json();

    // Build update object
    const updates: Record<string, unknown> = {};

    if (body.title !== undefined) updates.title = body.title.trim();
    if (body.message !== undefined) updates.message = body.message.trim();
    if (body.notification_type !== undefined)
      updates.notification_type = body.notification_type;
    if (body.priority !== undefined) updates.priority = body.priority;
    if (body.target_type !== undefined) updates.target_type = body.target_type;
    if (body.target_merchant_ids !== undefined)
      updates.target_merchant_ids = body.target_merchant_ids;
    if (body.target_segment !== undefined)
      updates.target_segment = body.target_segment;
    if (body.channels !== undefined) updates.channels = body.channels;
    if (body.action_url !== undefined) updates.action_url = body.action_url;
    if (body.action_label !== undefined)
      updates.action_label = body.action_label;
    if (body.scheduled_for !== undefined)
      updates.scheduled_for = body.scheduled_for;
    if (body.expires_at !== undefined) updates.expires_at = body.expires_at;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    // Update notification
    const { data: updated, error: updateError } = await supabase
      .from('notifications')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      logger.error({
        message: 'Error updating notification',
        error: updateError,
        id,
      });
      return NextResponse.json(
        { error: 'Failed to update notification' },
        { status: 500 }
      );
    }

    return NextResponse.json(updated);
  } catch (error) {
    logger.error({ message: 'Admin notification PATCH error', error });
    return NextResponse.json(
      { error: 'Failed to update notification' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/notifications/[id]
 * Delete/cancel a notification
 * Only accessible to platform administrators
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Validate ID as a UUID
    const validation = notificationIdSchema.safeParse(id);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid notification ID format' },
        { status: 400 }
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

    // Check if notification exists
    const { data: existing, error: fetchError } = await supabase
      .from('notifications')
      .select('id, sent_at')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    // Allow deletion even if sent (cascade will clean up merchant_notifications)
    const { error: deleteError } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id);

    if (deleteError) {
      logger.error({
        message: 'Error deleting notification',
        error: deleteError,
        id,
      });
      return NextResponse.json(
        { error: 'Failed to delete notification' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: existing.sent_at
        ? 'Sent notification deleted'
        : 'Scheduled notification cancelled',
    });
  } catch (error) {
    logger.error({ message: 'Admin notification DELETE error', error });
    return NextResponse.json(
      { error: 'Failed to delete notification' },
      { status: 500 }
    );
  }
}
