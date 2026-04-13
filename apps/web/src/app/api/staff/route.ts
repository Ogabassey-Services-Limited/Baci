import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateApiRequest, hasPermission } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { buildStaffInviteEmail } from '@/lib/staff-invite-email';
import { STAFF_COLUMNS } from '@/lib/staff-queries';
import { createClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/zeptomail';

const STAFF_ROLE_VALUES = [
  'admin',
  'manager',
  'sales_rep',
  'inventory',
  'accountant',
  'customer_service',
  'marketing',
  'fulfillment',
] as const;

export type StaffRole = (typeof STAFF_ROLE_VALUES)[number];

export interface StaffMember {
  id: string;
  merchant_id: string;
  user_id: string | null;
  email: string;
  name: string | null;
  role: StaffRole;
  permissions: Record<string, Record<string, boolean>>;
  status: 'pending' | 'active' | 'suspended' | 'removed';
  invited_at: string;
  accepted_at: string | null;
  last_login_at: string | null;
  created_at: string;
}

const inviteStaffSchema = z.object({
  email: z.string().trim().email('Invalid email format').max(254),
  name: z.string().trim().max(120).optional(),
  role: z.enum(STAFF_ROLE_VALUES),
});

const requestedMerchantSchema = z.string().uuid();

function parseRequestedMerchantId(request: Request | NextRequest) {
  const headerValue = request.headers.get('x-baci-merchant-id');

  if (!headerValue) {
    return { merchantId: null, error: null };
  }

  const parsed = requestedMerchantSchema.safeParse(headerValue);
  if (!parsed.success) {
    return {
      merchantId: null,
      error: NextResponse.json(
        { error: 'Invalid merchant context' },
        { status: 400 }
      ),
    };
  }

  return { merchantId: parsed.data, error: null };
}

/**
 * GET /api/staff
 * Returns all staff members for the merchant
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requestedMerchant = parseRequestedMerchantId(request);
    if (requestedMerchant.error) {
      return requestedMerchant.error;
    }

    const merchantContext = await getMerchantForApiRequest(supabase, user.id, {
      requestedMerchantId: requestedMerchant.merchantId,
    });
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

    // Get staff members
    const { data: staff, error: staffError } = await supabase
      .from('staff_members')
      .select(STAFF_COLUMNS)
      .eq('merchant_id', merchantId)
      .neq('status', 'removed')
      .order('created_at', { ascending: false });

    if (staffError) {
      console.error('Failed to fetch staff:', staffError);
      return NextResponse.json(
        { error: 'Failed to fetch staff' },
        { status: 500 }
      );
    }

    // Get role permissions for reference
    const { data: rolePermissions } = await supabase
      .from('role_permissions')
      .select('role, permissions');

    return NextResponse.json({
      staff: staff || [],
      rolePermissions: rolePermissions || [],
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
 * POST /api/staff
 * Invite a new staff member
 */
export async function POST(request: NextRequest) {
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

    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user || !auth.supabase) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const { user, supabase } = auth;

    const requestedMerchant = parseRequestedMerchantId(request);
    if (requestedMerchant.error) {
      return requestedMerchant.error;
    }

    const merchantContext = await getMerchantForApiRequest(supabase, user.id, {
      requestedMerchantId: requestedMerchant.merchantId,
    });
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

    const body: unknown = await request.json();
    const parsed = inviteStaffSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      );
    }

    const email = parsed.data.email.toLowerCase();
    const name = parsed.data.name?.trim() || undefined;
    const role = parsed.data.role;

    // Check if staff member already exists
    const { data: existing } = await supabase
      .from('staff_members')
      .select('id, status')
      .eq('merchant_id', merchantId)
      .eq('email', email)
      .single();

    if (existing) {
      if (existing.status === 'removed') {
        // Reactivate removed staff member
        const invitationToken = crypto.randomUUID();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

        const { data: reactivated, error: reactivateError } = await supabase
          .from('staff_members')
          .update({
            name,
            role,
            status: 'pending',
            invitation_token: invitationToken,
            invitation_expires_at: expiresAt.toISOString(),
            invited_at: new Date().toISOString(),
            accepted_at: null,
            user_id: null,
          })
          .eq('id', existing.id)
          .select(STAFF_COLUMNS)
          .single();

        if (reactivateError) {
          console.error('Failed to reactivate staff:', reactivateError);
          return NextResponse.json(
            { error: 'Failed to invite staff member' },
            { status: 500 }
          );
        }

        const { inviteUrl, email: inviteEmail } = buildStaffInviteEmail({
          businessName: businessName || 'Your Store',
          role,
          to: email,
          toName: name,
          token: invitationToken,
        });

        void sendEmail(inviteEmail).catch((error) => {
          console.error('Staff invitation email error:', error);
        });

        return NextResponse.json({
          staff: reactivated,
          inviteUrl,
          invitationToken,
          message: 'Staff member re-invited successfully',
        });
      }

      return NextResponse.json(
        {
          error:
            'Unable to invite staff member. Please check the email address and try again.',
        },
        { status: 409 }
      );
    }

    // Generate invitation token
    const invitationToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    // Create staff member
    const { data: newStaff, error: createError } = await supabase
      .from('staff_members')
      .insert({
        merchant_id: merchantId,
        email,
        name,
        role,
        invitation_token: invitationToken,
        invitation_expires_at: expiresAt.toISOString(),
      })
      .select(STAFF_COLUMNS)
      .single();

    if (createError) {
      console.error('Failed to create staff:', createError);
      return NextResponse.json(
        { error: 'Failed to invite staff member' },
        { status: 500 }
      );
    }

    const { inviteUrl, email: inviteEmail } = buildStaffInviteEmail({
      businessName: businessName || 'Your Store',
      role,
      to: email,
      toName: name,
      token: invitationToken,
    });

    const delivery = await sendEmail(inviteEmail);
    if (!delivery.success) {
      console.error('Staff invitation email error:', delivery.error);
    }

    return NextResponse.json(
      {
        staff: newStaff,
        inviteUrl,
        invitationToken,
        emailDelivery: delivery.success
          ? { status: 'sent' as const }
          : { status: 'failed' as const, error: delivery.error },
        message: delivery.success
          ? 'Staff member invited successfully'
          : 'Invitation created, but the email could not be delivered',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Staff invite error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
