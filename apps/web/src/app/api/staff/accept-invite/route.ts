import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkCsrfProtection } from '@/lib/csrf';
import { createClient } from '@/lib/supabase/server';

interface AcceptedStaff {
  id: string;
  role: string;
  merchant_id: string;
}

interface InvitePreview {
  email: string;
  role: string;
  merchant_business_name: string | null;
  merchant_slug?: string | null;
  invitation_expires_at: string;
}

const acceptInviteSchema = z.object({
  token: z.string().trim().min(1, 'Invitation token is required').max(255),
});

/**
 * POST /api/staff/accept-invite
 * Accept a staff invitation and link to user account
 */
export async function POST(request: NextRequest) {
  try {
    const { valid, response } = await checkCsrfProtection(request);
    if (!valid) {
      return (
        response ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

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

    // Validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }
    const parsed = acceptInviteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invitation token is required' },
        { status: 400 }
      );
    }
    const { token } = parsed.data;

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

    const acceptedStaff: AcceptedStaff | null =
      Array.isArray(acceptedRows) && acceptedRows.length > 0
        ? acceptedRows[0]
        : null;

    if (acceptError || !acceptedStaff) {
      const message = acceptError?.message || 'invalid_invite';

      const errorMap: Record<string, { status: number; error: string }> = {
        invite_expired: {
          status: 400,
          error: 'This invitation has expired',
        },
        invite_used: {
          status: 400,
          error: 'This invitation has already been used',
        },
        email_mismatch: {
          status: 403,
          error: 'This invitation was sent to a different email address',
        },
        already_owner: {
          status: 400,
          error: 'You are already the owner of this store',
        },
        already_staff: {
          status: 400,
          error: 'You are already a staff member of this store',
        },
        invalid_invite: {
          status: 404,
          error: 'Invalid or expired invitation',
        },
      };

      const errorResponse = errorMap[message] || {
        status: 500,
        error: 'Failed to accept invitation',
      };

      return NextResponse.json(
        { error: errorResponse.error },
        { status: errorResponse.status }
      );
    }

    return NextResponse.json({
      message: 'Invitation accepted successfully',
      staff: { id: acceptedStaff.id, role: acceptedStaff.role },
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
    const parsed = acceptInviteSchema.safeParse({
      token: searchParams.get('token'),
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'A valid invitation token is required' },
        { status: 400 }
      );
    }
    const { token } = parsed.data;

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data: previewRows, error } = await supabase.rpc(
      'get_staff_invite_preview',
      { p_token: token }
    );

    const invitation: InvitePreview | null =
      Array.isArray(previewRows) && previewRows.length > 0
        ? previewRows[0]
        : null;

    if (error) {
      console.error('Validate invitation RPC error:', error);
      return NextResponse.json(
        { error: 'Invitation service unavailable' },
        { status: 500 }
      );
    }

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invalid invitation' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      valid: true,
      email: invitation.email,
      role: invitation.role,
      merchantName:
        invitation.merchant_business_name ||
        invitation.merchant_slug ||
        'Unknown Store',
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
