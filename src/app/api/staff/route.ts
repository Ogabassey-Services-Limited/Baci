import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export type StaffRole =
  | 'admin'
  | 'manager'
  | 'sales_rep'
  | 'inventory'
  | 'accountant'
  | 'customer_service'
  | 'marketing'
  | 'fulfillment';

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

/**
 * GET /api/staff
 * Returns all staff members for the merchant
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get merchant
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }

    // Get staff members
    const { data: staff, error: staffError } = await supabase
      .from('staff_members')
      .select('*')
      .eq('merchant_id', merchant.id)
      .neq('status', 'removed')
      .order('created_at', { ascending: false });

    if (staffError) {
      console.error('Failed to fetch staff:', staffError);
      return NextResponse.json({ error: 'Failed to fetch staff' }, { status: 500 });
    }

    // Get role permissions for reference
    const { data: rolePermissions } = await supabase
      .from('role_permissions')
      .select('*');

    return NextResponse.json({
      staff: staff || [],
      rolePermissions: rolePermissions || [],
    });
  } catch (error) {
    console.error('Staff fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/staff
 * Invite a new staff member
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get merchant
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id, business_name')
      .eq('user_id', user.id)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }

    // Parse request body
    const body = await request.json();
    const { email, name, role } = body;

    // Validate required fields
    if (!email || !role) {
      return NextResponse.json(
        { error: 'Email and role are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Check if staff member already exists
    const { data: existing } = await supabase
      .from('staff_members')
      .select('id, status')
      .eq('merchant_id', merchant.id)
      .eq('email', email.toLowerCase())
      .single();

    if (existing) {
      if (existing.status === 'removed') {
        // Reactivate removed staff member
        const invitationToken = crypto.randomBytes(32).toString('hex');
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
          .select()
          .single();

        if (reactivateError) {
          console.error('Failed to reactivate staff:', reactivateError);
          return NextResponse.json({ error: 'Failed to invite staff member' }, { status: 500 });
        }

        return NextResponse.json({
          staff: reactivated,
          invitationToken,
          message: 'Staff member re-invited successfully',
        });
      }

      return NextResponse.json(
        { error: 'A staff member with this email already exists' },
        { status: 409 }
      );
    }

    // Generate invitation token
    const invitationToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    // Create staff member
    const { data: newStaff, error: createError } = await supabase
      .from('staff_members')
      .insert({
        merchant_id: merchant.id,
        email: email.toLowerCase(),
        name,
        role,
        invitation_token: invitationToken,
        invitation_expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (createError) {
      console.error('Failed to create staff:', createError);
      return NextResponse.json({ error: 'Failed to invite staff member' }, { status: 500 });
    }

    // TODO: Send invitation email
    // For now, return the invitation token (in production, this would be sent via email)
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invite/${invitationToken}`;

    return NextResponse.json({
      staff: newStaff,
      inviteUrl,
      message: 'Staff member invited successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('Staff invite error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
