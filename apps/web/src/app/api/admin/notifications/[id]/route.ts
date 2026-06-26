import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkCsrfProtection } from '@/lib/csrf';
import { getMerchantForApiRequest } from '@/lib/get-merchant-for-api-request';
import { logger } from '@/lib/logger';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import {
  mergedNotificationTargetingSchema,
  notificationIdSchema,
  updateNotificationSchema,
} from '@/schemas/notifications';

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

    // Fetch notification with delivery stats
    const { data: notification, error: fetchError } = await supabase
      .from('notifications')
      .select(
        'id, title, message, notification_type, priority, target_type, target_merchant_ids, target_segment, channels, action_url, action_label, scheduled_for, sent_at, expires_at, created_at, created_by'
      )
      .eq('id', id)
      .single();

    if (fetchError || !notification) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    // Use service-role client for stats queries to bypass RLS.
    // The RLS-scoped client would only count merchant_notifications for the
    // current admin's merchant, undercounting recipients across all merchants.
    const adminSupabase = createAdminClient();

    // PERFORMANCE: Use Promise.all to fetch independent queries concurrently
    // Get stats
    const statsQueryStartedAt = Date.now();
    const [
      { count: totalRecipients, error: totalError },
      { count: readCount, error: readError },
    ] = await Promise.all([
      adminSupabase
        .from('merchant_notifications')
        // PERFORMANCE: Use .select('id') instead of .select('*') for COUNT queries to prevent overfetching full rows
        .select('id', { count: 'exact', head: true })
        .eq('notification_id', id),
      adminSupabase
        .from('merchant_notifications')
        // PERFORMANCE: Use .select('id') instead of .select('*') for COUNT queries to prevent overfetching full rows
        .select('id', { count: 'exact', head: true })
        .eq('notification_id', id)
        .not('read_at', 'is', null),
    ]);
    const statsQueryDurationMs = Date.now() - statsQueryStartedAt;

    logger.info({
      message: 'notification_stats_query_ms',
      notification_id: id,
      duration_ms: statsQueryDurationMs,
      success: !totalError && !readError,
      total_error: Boolean(totalError),
      read_error: Boolean(readError),
    });

    if (totalError) {
      logger.error({
        message: 'Error fetching total recipients',
        error: totalError,
        id,
      });
    }

    if (readError) {
      logger.error({
        message: 'Error fetching read count',
        error: readError,
        id,
      });
    }

    const notificationWithStats = {
      ...notification,
      stats: {
        total_recipients: totalRecipients || 0,
        read_count: readCount || 0,
      },
    } satisfies Record<string, unknown>;

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
    const { valid, response } = await checkCsrfProtection(request);
    if (!valid) {
      return (
        response ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

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

    // Check if notification exists and hasn't been sent
    const { data: existing, error: fetchError } = await supabase
      .from('notifications')
      .select('id, sent_at, target_type, target_merchant_ids, target_segment')
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
    let json: unknown;
    try {
      json = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = updateNotificationSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: z.flattenError(parsed.error) },
        { status: 400 }
      );
    }
    const body = parsed.data;

    const effectiveTargetingValidation =
      mergedNotificationTargetingSchema.safeParse({
        target_type: body.target_type ?? existing.target_type ?? undefined,
        target_merchant_ids:
          body.target_merchant_ids !== undefined
            ? (body.target_merchant_ids ?? undefined)
            : Array.isArray(existing.target_merchant_ids)
              ? existing.target_merchant_ids
              : undefined,
        target_segment:
          body.target_segment ?? existing.target_segment ?? undefined,
      });
    if (!effectiveTargetingValidation.success) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          details: z.flattenError(effectiveTargetingValidation.error),
        },
        { status: 400 }
      );
    }

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
      .is('sent_at', null)
      .select(
        'id, title, message, notification_type, priority, target_type, target_merchant_ids, target_segment, channels, action_url, action_label, scheduled_for, sent_at, expires_at, created_at, created_by'
      )
      .maybeSingle();

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

    if (!updated) {
      return NextResponse.json(
        { error: 'Cannot update a notification that has already been sent' },
        { status: 400 }
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
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { valid, response } = await checkCsrfProtection(request);
    if (!valid) {
      return (
        response ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

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
