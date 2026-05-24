import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { StaffAcceptFallback } from '@/app/(platform)/staff/accept/staff-accept-fallback';
import { createClient } from '@/lib/supabase/server';
import { staffAcceptSchema } from '@/schemas/staff-accept';
import ErrorPage from './ErrorPage';
import InvitePage from './InvitePage';

interface AcceptPageProps {
  searchParams: Promise<{ token?: string | string[] }>;
}

export default function StaffAcceptPage(props: AcceptPageProps) {
  return (
    <Suspense fallback={<StaffAcceptFallback />}>
      <StaffAcceptPageContent {...props} />
    </Suspense>
  );
}

/** Exported so route tests can exercise resolved invitation states. */
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

  // Get authenticated client
  const supabase = await createClient();

  // Validate invitation token atomically using preview RPC under RLS
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

  // Get authenticated user and handle transient auth backend errors explicitly
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

  // If not logged in, show invitation preview card
  if (!user) {
    return (
      <InvitePage
        merchantName={merchantName}
        role={invitation.role}
        inviteEmail={invitation.email}
        token={result.data.token}
      />
    );
  }

  // Check if email matches
  if (user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
    return (
      <ErrorPage
        title="Wrong Account"
        message={`This invitation was sent to ${invitation.email}. Please sign in with that email address.`}
        showLoginLink
        currentEmail={user.email}
        loginRedirect={`/staff/accept?token=${result.data.token}`}
      />
    );
  }

  // Auto-accept the invitation atomically inside the database under RLS using the secure RPC
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
    return (
      <ErrorPage
        title="Error"
        message="Failed to accept the invitation. Please try again or contact support."
      />
    );
  }

  // Success! Redirect to dashboard
  redirect('/dashboard');
}
