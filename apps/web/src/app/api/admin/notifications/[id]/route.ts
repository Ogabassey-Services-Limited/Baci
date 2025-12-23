import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
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

    // Fetch notification
    const { data: notification, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !notification) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    // Fetch stats
    const { data: stats } = await supabase.rpc('get_notification_stats', {
      p_notification_id: id,
    });

    // Fetch delivery details (per-merchant status)
    const { data: deliveries } = await supabase
      .from('merchant_notifications')
      .select(`
        id,
        merchant_id,
        read_at,
        dismissed_at,
        banner_dismissed_at,
        created_at,
        merchants (
          id,
          business_name,
          user_id
        )
      `)
      .eq('notification_id', id)
      .order('created_at', { ascending: false })
      .limit(100);

    const notificationWithStats: NotificationWithStats & {
      deliveries: unknown[];
    } = {
      ...notification,
      stats: stats?.[0] || {
        total_sent: 0,
        total_read: 0,
        total_dismissed: 0,
        read_rate: 0,
      },
      deliveries: deliveries || [],
    };

    return NextResponse.json(notificationWithStats);
  } catch (error) {
    console.error('Admin notification GET error:', error);
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
      console.error('Error updating notification:', updateError);
      return NextResponse.json(
        { error: 'Failed to update notification' },
        { status: 500 }
      );
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Admin notification PATCH error:', error);
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
      console.error('Error deleting notification:', deleteError);
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
    console.error('Admin notification DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete notification' },
      { status: 500 }
    );
  }
}
