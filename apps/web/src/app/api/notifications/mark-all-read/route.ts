import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { hasPermission } from '@/lib/api-auth';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { createClient } from '@/lib/supabase/server';
import { checkCsrfProtection } from '@/lib/csrf';

/**
 * PATCH /api/notifications/mark-all-read
 * Mark all unread notifications for the current merchant as read
 */
export async function PATCH(request: NextRequest) {
  try {
    // CSRF protection for state-changing endpoints
    const csrfCheck = await checkCsrfProtection(request);
    if (!csrfCheck.valid) {
      return csrfCheck.response || NextResponse.json(
        { error: 'Invalid or missing CSRF token' },
        { status: 403 }
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

    // Update all unread notifications to read
    const { error: updateError } = await supabase
      .from('merchant_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('merchant_id', merchantId)
      .is('read_at', null)
      .is('dismissed_at', null);

    if (updateError) {
      console.error('Error marking all notifications as read:', updateError);
      return NextResponse.json(
        { error: 'Failed to mark all notifications as read' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      unread_count: 0,
    });
  } catch (error) {
    console.error('Notifications mark all read PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to mark all notifications as read' },
      { status: 500 }
    );
  }
}
