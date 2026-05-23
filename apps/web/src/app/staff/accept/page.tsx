import '@/app/globals.css';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { StaffAcceptFallback } from '@/app/staff/accept/staff-accept-fallback';
import { Logo } from '@/components/logo';
import { ThemedButton } from '@/components/themed/themed-button';
import { ThemedCard } from '@/components/themed/themed-card';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

interface AcceptPageProps {
  searchParams: Promise<{ token?: string }>;
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
  const token = params.token;

  // No token provided
  if (!token) {
    return (
      <ErrorPage
        title="Invalid Link"
        message="No invitation token was provided. Please check your email for the correct link."
      />
    );
  }

  // Validate token using admin client (bypass RLS)
  const supabaseAdmin = createAdminClient();
  const { data: invitation, error: inviteError } = await supabaseAdmin
    .from('staff_members')
    .select(
      'id, email, role, status, invitation_expires_at, merchants(business_name, slug)'
    )
    .eq('invitation_token', token)
    .single();

  if (inviteError || !invitation) {
    return (
      <ErrorPage
        title="Invalid Invitation"
        message="This invitation link is invalid or has already been used."
      />
    );
  }

  // Check if already accepted
  if (invitation.status !== 'pending') {
    return (
      <ErrorPage
        title="Already Accepted"
        message="This invitation has already been accepted. You can sign in to access the dashboard."
        showLoginLink
      />
    );
  }

  // Check expiry
  if (new Date(invitation.invitation_expires_at) < new Date()) {
    return (
      <ErrorPage
        title="Invitation Expired"
        message="This invitation has expired. Please ask the store owner to send a new invitation."
      />
    );
  }

  // Get merchant info - handle both array and object from Supabase join
  const merchantsData = invitation.merchants;
  const merchantInfo = Array.isArray(merchantsData)
    ? (merchantsData[0] as { business_name: string; slug: string } | undefined)
    : (merchantsData as { business_name: string; slug: string } | null);
  const merchantName = merchantInfo?.business_name || 'Unknown Store';

  // Check if user is logged in
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If not logged in, show login prompt
  if (!user) {
    return (
      <InvitePage
        merchantName={merchantName}
        role={invitation.role}
        inviteEmail={invitation.email}
        token={token}
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
      />
    );
  }

  // Auto-accept the invitation!
  const { error: acceptError } = await supabaseAdmin
    .from('staff_members')
    .update({
      user_id: user.id,
      status: 'active',
      accepted_at: new Date().toISOString(),
      invitation_token: null,
    })
    .eq('id', invitation.id);

  if (acceptError) {
    console.error('[Staff Accept] Error accepting invitation:', acceptError);
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

// ============================================================================
// Component: Invite Page (for non-logged-in users)
// ============================================================================
function InvitePage({
  merchantName,
  role,
  inviteEmail,
  token,
}: {
  merchantName: string;
  role: string;
  inviteEmail: string;
  token: string;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-primary/5 to-secondary/5 p-4">
      <ThemedCard className="w-full max-w-md p-8 shadow-xl">
        <div className="text-center mb-8">
          <Logo className="mx-auto" />
        </div>

        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold mb-2">You're Invited! 🎉</h1>
          <p className="text-muted-foreground">
            <strong>{merchantName}</strong> has invited you to join their team
            as a <strong>{role}</strong>.
          </p>
        </div>

        <div className="bg-muted/50 rounded-lg p-4 mb-6">
          <p className="text-sm text-muted-foreground">
            <strong>Invitation sent to:</strong>
            <br />
            {inviteEmail}
          </p>
        </div>

        <div className="space-y-4">
          <Link href={`/login?redirect=/staff/accept?token=${token}`}>
            <ThemedButton className="w-full" size="lg">
              Sign In to Accept
            </ThemedButton>
          </Link>

          <p className="text-xs text-center text-muted-foreground">
            Don't have an account?{' '}
            <Link
              href={`/signup?email=${encodeURIComponent(inviteEmail)}&redirect=/staff/accept?token=${token}`}
              className="text-primary hover:underline"
            >
              Create one
            </Link>
          </p>
        </div>
      </ThemedCard>
    </div>
  );
}

// ============================================================================
// Component: Error Page
// ============================================================================
function ErrorPage({
  title,
  message,
  showLoginLink = false,
  currentEmail,
}: {
  title: string;
  message: string;
  showLoginLink?: boolean;
  currentEmail?: string;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-red-500/5 to-orange-500/5 p-4">
      <ThemedCard className="w-full max-w-md p-8 shadow-xl">
        <div className="text-center mb-8">
          <Logo className="mx-auto" />
        </div>

        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <span className="text-3xl">⚠️</span>
          </div>
          <h1 className="text-2xl font-bold mb-2 text-red-600 dark:text-red-400">
            {title}
          </h1>
          <p className="text-muted-foreground">{message}</p>
        </div>

        {currentEmail && (
          <div className="bg-muted/50 rounded-lg p-4 mb-6">
            <p className="text-sm text-muted-foreground">
              <strong>Currently signed in as:</strong>
              <br />
              {currentEmail}
            </p>
          </div>
        )}

        <div className="space-y-4">
          {showLoginLink && (
            <Link href="/login">
              <ThemedButton className="w-full" variant="outline">
                Sign In with Different Account
              </ThemedButton>
            </Link>
          )}

          <Link href="/">
            <ThemedButton className="w-full" variant="ghost">
              Return Home
            </ThemedButton>
          </Link>
        </div>
      </ThemedCard>
    </div>
  );
}
