import { redirect } from 'next/navigation';
import ErrorPage from '@/app/(platform)/staff/accept/ErrorPage';
import InvitePage from '@/app/(platform)/staff/accept/InvitePage';
import { createClient } from '@/lib/supabase/server';
import { staffAcceptSchema } from '@/schemas/staff-accept';

interface AcceptPageProps {
  searchParams: Promise<{ token?: string | string[] }>;
}

export async function StaffAcceptPageContent({
  searchParams,
}: AcceptPageProps) {
  const params = await searchParams;
  const rawToken = params.token;
  const coercedToken = Array.isArray(rawToken) ? rawToken[0] : rawToken;
  const token = coercedToken?.trim() || undefined;

  const result = staffAcceptSchema.safeParse({ token });
  if (!result.success) {
    return (
      <ErrorPage
        title="Invalid Link"
        message={result.error.issues[0].message}
      />
    );
  }

  const supabase = await createClient();
  const { data: previewRows, error: previewError } = await supabase.rpc(
    'get_staff_invite_preview',
    { p_token: result.data.token }
  );

  const invitation =
    Array.isArray(previewRows) && previewRows.length > 0
      ? previewRows[0]
      : null;

  if (previewError || !invitation) {
    console.error(
      '[Staff Accept] Error fetching invite preview:',
      previewError
    );
    return (
      <ErrorPage
        title="Invalid Invitation"
        message="This invitation link is invalid, has expired, or has already been used."
      />
    );
  }

  const merchantName = invitation.merchant_business_name || 'Unknown Store';
  const inviteEmail =
    typeof invitation.email === 'string' ? invitation.email.trim() : '';

  if (!inviteEmail) {
    return (
      <ErrorPage
        title="Invalid Invitation"
        message="This invitation is missing the recipient email address. Please ask the store owner to send a new invitation."
      />
    );
  }

  const resp = await supabase.auth.getUser();
  const user = resp.data?.user || null;

  if (resp.error) {
    const isSessionMissing =
      resp.error.name === 'AuthSessionMissingError' ||
      resp.error.message?.includes('session') ||
      resp.error.status === 401;

    if (!isSessionMissing) {
      console.error('[Staff Accept] Auth getUser error:', resp.error);
      return (
        <ErrorPage
          title="Authentication Error"
          message="A transient authentication failure occurred. Please refresh or try again later."
        />
      );
    }
  }

  if (!user) {
    return (
      <InvitePage
        merchantName={merchantName}
        staffRole={invitation.role}
        inviteEmail={inviteEmail}
        token={result.data.token}
      />
    );
  }

  if (user.email?.toLowerCase() !== inviteEmail.toLowerCase()) {
    return (
      <ErrorPage
        title="Wrong Account"
        message={`This invitation was sent to ${inviteEmail}. Please sign in with that email address.`}
        showLoginLink
        currentEmail={user.email}
        loginRedirect={`/staff/accept?token=${result.data.token}`}
      />
    );
  }

  const { error: acceptError } = await supabase.rpc('accept_staff_invite', {
    p_token: result.data.token,
    p_email: user.email,
  });

  if (acceptError) {
    console.error('[Staff Accept] Error accepting invitation:', acceptError);
    const message = acceptError.message || '';
    if (message === 'invite_expired') {
      return (
        <ErrorPage
          title="Invitation Expired"
          message="This invitation has expired. Please ask the store owner to send a new invitation."
        />
      );
    }
    if (message === 'invite_used') {
      return (
        <ErrorPage
          title="Already Accepted"
          message="This invitation has already been accepted or used."
          showLoginLink
        />
      );
    }
    if (message === 'email_mismatch') {
      return (
        <ErrorPage
          title="Wrong Account"
          message="This invitation was sent to a different email address. Sign in with the invited email to accept it."
          showLoginLink
        />
      );
    }
    if (message === 'already_owner' || message === 'already_staff') {
      return (
        <ErrorPage
          title="Already a Member"
          message="You are already part of this store."
          showLoginLink
        />
      );
    }
    if (message === 'owner_cannot_join_as_staff') {
      return (
        <ErrorPage
          title="Store Owner"
          message="You already own a store, so you cannot join another as staff yet."
          showLoginLink
        />
      );
    }
    return (
      <ErrorPage
        title="Error"
        message="Failed to accept the invitation. Please try again or contact support."
      />
    );
  }

  redirect('/dashboard');
}
