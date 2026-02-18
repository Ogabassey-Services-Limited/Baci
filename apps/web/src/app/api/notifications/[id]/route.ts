import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { hasPermission } from '@/lib/api-auth';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { createClient } from '@/lib/supabase/server';
import type { UpdateMerchantNotificationInput } from '@/types/notifications';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/notifications/[id]
 * Get a specific notification for the current merchant
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

    // Get merchant (supports both owners and staff)
    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }
    const merchantId = merchantContext.merchantId;
    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'dashboard', 'view')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    // Fetch notification
    const { data: notification, error } = await supabase
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
      .eq('id', id)
      .eq('merchant_id', merchantId)
      .single();

    if (error || !notification) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(notification);
  } catch (error) {
    console.error('Notification GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notification' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/notifications/[id]
 * Update notification status (mark as read, dismiss, etc.)
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

    // Get merchant (supports both owners and staff)
    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }
    const merchantId = merchantContext.merchantId;
    const patchAccess = toUserAccess(merchantContext);
    if (!hasPermission(patchAccess, 'dashboard', 'view')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    // Parse request body
    const body: UpdateMerchantNotificationInput = await request.json();

    // Build update object
    const updates: Record<string, unknown> = {};

    if (body.read === true) {
      updates.read_at = new Date().toISOString();
    } else if (body.read === false) {
      updates.read_at = null;
    }

    if (body.dismissed === true) {
      updates.dismissed_at = new Date().toISOString();
    }

    if (body.banner_dismissed === true) {
      updates.banner_dismissed_at = new Date().toISOString();
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    // Update notification
    const { data: updated, error: updateError } = await supabase
      .from('merchant_notifications')
      .update(updates)
      .eq('id', id)
      .eq('merchant_id', merchantId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating notification:', updateError);
      return NextResponse.json(
        { error: 'Failed to update notification' },
        { status: 500 }
      );
    }

    if (!updated) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    // Get updated unread count
    const { count: unreadCount } = await supabase
      .from('merchant_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('merchant_id', merchantId)
      .is('read_at', null)
      .is('dismissed_at', null);

    return NextResponse.json({
      ...updated,
      unread_count: unreadCount || 0,
    });
  } catch (error) {
    console.error('Notification PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to update notification' },
      { status: 500 }
    );
  }
}
