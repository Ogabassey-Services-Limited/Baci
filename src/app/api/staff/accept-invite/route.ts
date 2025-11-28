import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/staff/accept-invite
 * Accept a staff invitation and link to user account
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized - Please sign in first' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ error: 'Invitation token is required' }, { status: 400 });
    }

    // Find invitation by token
    const { data: invitation, error: findError } = await supabase
      .from('staff_members')
      .select('*, merchants(business_name)')
      .eq('invitation_token', token)
      .single();

    if (findError || !invitation) {
      return NextResponse.json({ error: 'Invalid or expired invitation' }, { status: 404 });
    }

    // Check if invitation is still pending
    if (invitation.status !== 'pending') {
      return NextResponse.json({ error: 'This invitation has already been used' }, { status: 400 });
    }

    // Check if invitation has expired
    if (new Date(invitation.invitation_expires_at) < new Date()) {
      return NextResponse.json({ error: 'This invitation has expired' }, { status: 400 });
    }

    // Check if email matches
    if (invitation.email.toLowerCase() !== user.email?.toLowerCase()) {
      return NextResponse.json(
        { error: 'This invitation was sent to a different email address' },
        { status: 403 }
      );
    }

    // Check if user is already the merchant owner
    const { data: ownedMerchant } = await supabase
      .from('merchants')
      .select('id')
      .eq('id', invitation.merchant_id)
      .eq('user_id', user.id)
      .single();

    if (ownedMerchant) {
      return NextResponse.json(
        { error: 'You are already the owner of this store' },
        { status: 400 }
      );
    }

    // Check if user already has a staff record for this merchant
    const { data: existingStaff } = await supabase
      .from('staff_members')
      .select('id')
      .eq('merchant_id', invitation.merchant_id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (existingStaff) {
      return NextResponse.json(
        { error: 'You are already a staff member of this store' },
        { status: 400 }
      );
    }

    // Accept invitation - link user and activate
    const { data: acceptedStaff, error: acceptError } = await supabase
      .from('staff_members')
      .update({
        user_id: user.id,
        status: 'active',
        accepted_at: new Date().toISOString(),
        invitation_token: null, // Clear token after use
      })
      .eq('id', invitation.id)
      .select('*, merchants(business_name, slug)')
      .single();

    if (acceptError) {
      console.error('Failed to accept invitation:', acceptError);
      return NextResponse.json({ error: 'Failed to accept invitation' }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Invitation accepted successfully',
      staff: acceptedStaff,
      redirectUrl: '/dashboard',
    });
  } catch (error) {
    console.error('Accept invitation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/staff/accept-invite?token=xxx
 * Validate an invitation token (for preview before accepting)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Find invitation by token
    const { data: invitation, error } = await supabase
      .from('staff_members')
      .select('email, role, status, invitation_expires_at, merchants(business_name)')
      .eq('invitation_token', token)
      .single();

    if (error || !invitation) {
      return NextResponse.json({ error: 'Invalid invitation' }, { status: 404 });
    }

    // Check if already accepted
    if (invitation.status !== 'pending') {
      return NextResponse.json({ error: 'This invitation has already been used' }, { status: 400 });
    }

    // Check expiry
    if (new Date(invitation.invitation_expires_at) < new Date()) {
      return NextResponse.json({ error: 'This invitation has expired' }, { status: 400 });
    }

    // Extract merchant name from the joined data
    // Supabase returns nested relations as objects for single relations
    const merchantInfo = invitation.merchants as unknown as { business_name: string } | null;

    return NextResponse.json({
      valid: true,
      email: invitation.email,
      role: invitation.role,
      merchantName: merchantInfo?.business_name || 'Unknown Store',
      expiresAt: invitation.invitation_expires_at,
    });
  } catch (error) {
    console.error('Validate invitation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
