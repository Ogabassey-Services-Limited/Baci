import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { getAppUrl } from '@/env';
import { hasPermission } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { STAFF_COLUMNS } from '@/lib/staff-queries';
import { createClient } from '@/lib/supabase/server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/staff/[id]
 * Get a specific staff member's details
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'staff', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const merchantId = merchantContext.merchantId;

    // Get staff member
    const { data: staff, error } = await supabase
      .from('staff_members')
      .select(STAFF_COLUMNS)
      .eq('id', id)
      .eq('merchant_id', merchantId)
      .single();

    if (error || !staff) {
      return NextResponse.json(
        { error: 'Staff member not found' },
        { status: 404 }
      );
    }

    // Get effective permissions
    const { data: effectivePermissions } = await supabase.rpc(
      'get_staff_permissions',
      { p_staff_id: id }
    );

    return NextResponse.json({
      staff,
      effectivePermissions: effectivePermissions || {},
    });
  } catch (error) {
    console.error('Staff fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/staff/[id]
 * Update a staff member (role, permissions, status)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    // CSRF protection
    const { valid: csrfValid, response: csrfResponse } =
      await checkCsrfProtection(request);
    if (!csrfValid) {
      return (
        csrfResponse ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    const { id } = await params;
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'staff', 'edit')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const merchantId = merchantContext.merchantId;

    // Verify staff member belongs to merchant
    const { data: existing } = await supabase
      .from('staff_members')
      .select('id')
      .eq('id', id)
      .eq('merchant_id', merchantId)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: 'Staff member not found' },
        { status: 404 }
      );
    }

    // Parse request body
    const body = await request.json();

    // Allowlist of updatable fields
    const allowedFields = ['name', 'role', 'permissions', 'status'];
    const updateData: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (field in body && body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Update staff member
    const { data: updated, error } = await supabase
      .from('staff_members')
      .update(updateData)
      .eq('id', id)
      .eq('merchant_id', merchantId)
      .select(STAFF_COLUMNS)
      .single();

    if (error) {
      console.error('Failed to update staff:', error);
      return NextResponse.json(
        { error: 'Failed to update staff member' },
        { status: 500 }
      );
    }

    return NextResponse.json({ staff: updated });
  } catch (error) {
    console.error('Staff update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/staff/[id]
 * Remove a staff member (soft delete)
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    // CSRF protection
    const { valid: csrfValid, response: csrfResponse } =
      await checkCsrfProtection(_request);
    if (!csrfValid) {
      return (
        csrfResponse ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    const { id } = await params;
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'staff', 'remove')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const merchantId = merchantContext.merchantId;

    // Soft delete staff member
    const { error } = await supabase
      .from('staff_members')
      .update({ status: 'removed' })
      .eq('id', id)
      .eq('merchant_id', merchantId);

    if (error) {
      console.error('Failed to remove staff:', error);
      return NextResponse.json(
        { error: 'Failed to remove staff member' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Staff delete error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/staff/[id]/resend
 * Resend invitation to a pending staff member
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    // CSRF protection
    const { valid: csrfValid, response: csrfResponse } =
      await checkCsrfProtection(_request);
    if (!csrfValid) {
      return (
        csrfResponse ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    const { id } = await params;
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'staff', 'invite')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const merchantId = merchantContext.merchantId;
    const businessName = merchantContext.businessName;

    // Get staff member
    const { data: staff } = await supabase
      .from('staff_members')
      .select('id, email, status')
      .eq('id', id)
      .eq('merchant_id', merchantId)
      .single();

    if (!staff) {
      return NextResponse.json(
        { error: 'Staff member not found' },
        { status: 404 }
      );
    }

    if (staff.status !== 'pending') {
      return NextResponse.json(
        { error: 'Can only resend invitation to pending staff members' },
        { status: 400 }
      );
    }

    // Generate new invitation token
    const invitationToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Update staff member with new token
    const { error: updateError } = await supabase
      .from('staff_members')
      .update({
        invitation_token: invitationToken,
        invitation_expires_at: expiresAt.toISOString(),
        invited_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('merchant_id', merchantId);

    if (updateError) {
      console.error('Failed to update invitation:', updateError);
      return NextResponse.json(
        { error: 'Failed to resend invitation' },
        { status: 500 }
      );
    }

    const inviteUrl = `${getAppUrl()}/invite/${invitationToken}`;

    // Note: businessName may be undefined if not set on merchant record
    // The email send is intentionally not included here (matching original behavior)
    // where the resend only returns the new inviteUrl without sending an email
    void businessName; // acknowledge the variable is available if needed

    return NextResponse.json({
      success: true,
      inviteUrl,
    });
  } catch (error) {
    console.error('Resend invitation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
