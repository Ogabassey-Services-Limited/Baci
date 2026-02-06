import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/staff/accept-invite
 * Accept a staff invitation and link to user account
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - Please sign in first' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { error: 'Invitation token is required' },
        { status: 400 }
      );
    }

    if (!user.email) {
      return NextResponse.json(
        { error: 'User email is required to accept invitation' },
        { status: 400 }
      );
    }

    const { data: acceptedRows, error: acceptError } = await supabase.rpc(
      'accept_staff_invite',
      {
        p_token: token,
        p_email: user.email,
      }
    );

    const acceptedStaff =
      Array.isArray(acceptedRows) && acceptedRows.length > 0
        ? acceptedRows[0]
        : null;

    if (acceptError || !acceptedStaff) {
      const message = acceptError?.message || 'Failed to accept invitation';
      const status =
        message === 'invite_expired' || message === 'invite_used'
          ? 400
          : message === 'email_mismatch'
            ? 403
            : message === 'already_owner' || message === 'already_staff'
              ? 400
              : message === 'invalid_invite'
                ? 404
                : 500;
      return NextResponse.json(
        {
          error:
            message === 'invite_expired'
              ? 'This invitation has expired'
              : message === 'invite_used'
                ? 'This invitation has already been used'
                : message === 'email_mismatch'
                  ? 'This invitation was sent to a different email address'
                  : message === 'already_owner'
                    ? 'You are already the owner of this store'
                    : message === 'already_staff'
                      ? 'You are already a staff member of this store'
                      : message === 'invalid_invite'
                        ? 'Invalid or expired invitation'
                        : 'Failed to accept invitation',
        },
        { status }
      );
    }

    return NextResponse.json({
      message: 'Invitation accepted successfully',
      staff: acceptedStaff,
      redirectUrl: '/dashboard',
    });
  } catch (error) {
    console.error('Accept invitation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
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

    const { data: previewRows, error } = await supabase.rpc(
      'get_staff_invite_preview',
      { p_token: token }
    );

    const invitation =
      Array.isArray(previewRows) && previewRows.length > 0
        ? previewRows[0]
        : null;

    if (error || !invitation) {
      return NextResponse.json(
        { error: 'Invalid invitation' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      valid: true,
      email: invitation.email,
      role: invitation.role,
      merchantName: invitation.merchant_business_name || 'Unknown Store',
      expiresAt: invitation.invitation_expires_at,
    });
  } catch (error) {
    console.error('Validate invitation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
