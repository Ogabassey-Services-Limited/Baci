'use client';

import {
  Building2,
  CheckCircle,
  Loader2,
  LogIn,
  Mail,
  Shield,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useEffectEvent, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiPost } from '@/lib/api-client';
import {
  buildStaffInvitePath,
  resolveStaffPostAcceptRedirect,
  STAFF_INVITE_ACCEPT_QUERY_PARAM,
  STAFF_INVITE_CLIENT_QUERY_PARAM,
} from '@/lib/staff-invite-flow';
import { createClient } from '@/lib/supabase/client';

interface InvitationDetails {
  valid: boolean;
  email: string;
  role: string;
  merchantName: string;
  expiresAt: string;
}

const roleLabels: Record<string, string> = {
  admin: 'Administrator',
  manager: 'Manager',
  sales_rep: 'Sales Representative',
  inventory: 'Inventory Manager',
  accountant: 'Accountant',
  customer_service: 'Customer Service',
  marketing: 'Marketing',
  fulfillment: 'Fulfillment',
};

type SupabaseBrowserClient = ReturnType<typeof createClient>;
type SupabaseAuth = SupabaseBrowserClient['auth'];

interface InvitationLoadResult {
  user: { email: string } | null;
  invitation: InvitationDetails | null;
  error: string | null;
}

function detectIsMobileBrowser() {
  return /android|iphone|ipad|ipod/i.test(navigator.userAgent);
}

// Module-scope helpers keep the component body free of try/finally and
// throw-inside-try statements that block React Compiler memoization.
async function loadInvitation(
  auth: SupabaseAuth,
  token: string
): Promise<InvitationLoadResult> {
  try {
    const {
      data: { user: currentUser },
      error: userError,
    } = await auth.getUser();

    if (userError) {
      console.warn('Invite user session unavailable:', userError);
    }

    const response = await fetch(
      `/api/staff/accept-invite?token=${encodeURIComponent(token)}`
    );
    const data = await response.json();

    if (!response.ok) {
      return {
        user:
          !userError && currentUser?.email
            ? { email: currentUser.email }
            : null,
        invitation: null,
        error: data.error || 'Invalid invitation',
      };
    }

    return {
      user:
        !userError && currentUser?.email ? { email: currentUser.email } : null,
      invitation: data,
      error: null,
    };
  } catch (err) {
    console.error('Error validating invitation:', err);
    return {
      user: null,
      invitation: null,
      error: 'Failed to validate invitation',
    };
  }
}

interface AcceptInvitationResult {
  ok: boolean;
  error?: string;
}

async function postAcceptInvitation(
  token: string
): Promise<AcceptInvitationResult> {
  try {
    await apiPost('/api/staff/accept-invite', { token });

    return { ok: true };
  } catch (err) {
    console.error('Error accepting invitation:', err);
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : 'Failed to accept invitation. Please try again.',
    };
  }
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<AcceptInvitePageFallback />}>
      <AcceptInvitePageContent />
    </Suspense>
  );
}

function AcceptInvitePageFallback() {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-gray-50 p-4"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading invitation…</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AcceptInvitePageContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const token = params.token as string;
  const acceptRequested =
    searchParams.get(STAFF_INVITE_ACCEPT_QUERY_PARAM) === '1';
  const requestedClient = searchParams.get(STAFF_INVITE_CLIENT_QUERY_PARAM);

  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [isMobileBrowser, setIsMobileBrowser] = useState(false);
  const autoAcceptAttemptedRef = useRef(false);

  const supabase = createClient();
  const normalizedRequestedClient = requestedClient?.trim().toLowerCase();
  const inviteClient =
    normalizedRequestedClient === 'mobile' ||
    normalizedRequestedClient === 'web'
      ? normalizedRequestedClient
      : isMobileBrowser
        ? 'mobile'
        : 'web';
  const postAuthRedirect = buildStaffInvitePath(token, {
    autoAccept: true,
    client: inviteClient,
  });
  const emailMismatch =
    user &&
    invitation &&
    user.email.toLowerCase() !== invitation.email.toLowerCase();

  useEffect(() => {
    setIsMobileBrowser(detectIsMobileBrowser());
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadInvitation(supabase.auth, token)
      .then((result) => {
        if (cancelled) {
          return;
        }
        if (result.user) {
          setUser(result.user);
        }
        if (result.error) {
          setError(result.error);
          return;
        }
        if (result.invitation) {
          setInvitation(result.invitation);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token, supabase.auth]);

  const redirectAfterAcceptance = () => {
    const redirectTarget = resolveStaffPostAcceptRedirect(inviteClient);

    if (redirectTarget === '/dashboard' || typeof window === 'undefined') {
      router.replace('/dashboard');
      return;
    }

    window.location.assign(redirectTarget);
    const fallbackTimeout = window.setTimeout(() => {
      if (!document.hidden) {
        router.replace('/dashboard');
      }
      document.removeEventListener('visibilitychange', clearFallbackOnAppOpen);
    }, 2500);

    function clearFallbackOnAppOpen() {
      if (document.hidden) {
        window.clearTimeout(fallbackTimeout);
        document.removeEventListener(
          'visibilitychange',
          clearFallbackOnAppOpen
        );
      }
    }

    document.addEventListener('visibilitychange', clearFallbackOnAppOpen);
  };

  const acceptInvitation = () => {
    setAccepting(true);
    return postAcceptInvitation(token)
      .then((result) => {
        if (!result.ok) {
          toast({
            title: 'Error',
            description: result.error,
            variant: 'destructive',
          });
          return;
        }

        setAccepted(true);
        toast({
          title: 'Welcome to the team!',
          description: `You've joined ${invitation?.merchantName} as ${roleLabels[invitation?.role || ''] || invitation?.role}.`,
        });

        window.setTimeout(() => {
          redirectAfterAcceptance();
        }, 800);
      })
      .finally(() => {
        setAccepting(false);
      });
  };

  const handleAcceptInvitation = async () => {
    if (!user) {
      const loginParams = new URLSearchParams({
        redirect: postAuthRedirect,
        email: invitation?.email || '',
      });
      router.push(`/login?${loginParams.toString()}`);
      return;
    }

    await acceptInvitation();
  };

  const autoAcceptInvitation = useEffectEvent(() => {
    void acceptInvitation();
  });

  useEffect(() => {
    if (
      !acceptRequested ||
      autoAcceptAttemptedRef.current ||
      !user ||
      !invitation ||
      emailMismatch ||
      accepted ||
      accepting
    ) {
      return;
    }

    autoAcceptAttemptedRef.current = true;
    autoAcceptInvitation();
  }, [acceptRequested, accepted, accepting, emailMismatch, invitation, user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="size-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Validating invitation…</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-red-100">
              <XCircle className="size-6 text-red-600" />
            </div>
            <CardTitle>Invalid Invitation</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              This invitation link may have expired or already been used. Please
              contact the store owner for a new invitation.
            </p>
            <Link href="/">
              <Button variant="outline">Go to Homepage</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="size-6 text-green-600" />
            </div>
            <CardTitle>Welcome to the Team!</CardTitle>
            <CardDescription>
              You've successfully joined {invitation?.merchantName}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              {inviteClient === 'mobile'
                ? 'Opening the Baci app…'
                : 'Redirecting you to the dashboard…'}
            </p>
            <Loader2 className="size-5 animate-spin mx-auto text-primary" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10">
            <Mail className="size-6 text-primary" />
          </div>
          <CardTitle>Team Invitation</CardTitle>
          <CardDescription>You've been invited to join a team</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Invitation Details */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <Building2 className="size-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Store</p>
                <p className="font-medium">{invitation?.merchantName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <Shield className="size-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Role</p>
                <p className="font-medium">
                  {roleLabels[invitation?.role || ''] || invitation?.role}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <Mail className="size-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Invited Email</p>
                <p className="font-medium">{invitation?.email}</p>
              </div>
            </div>
          </div>

          {/* Email Mismatch Warning */}
          {emailMismatch && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> This invitation was sent to{' '}
                <span className="font-medium">{invitation?.email}</span>, but
                you're signed in as{' '}
                <span className="font-medium">{user?.email}</span>.
              </p>
              <p className="text-sm text-yellow-700 mt-1">
                Please sign in with the correct email to accept this invitation.
              </p>
            </div>
          )}

          {/* Current User Info */}
          {user && !emailMismatch && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">
                Signed in as <span className="font-medium">{user.email}</span>
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3">
            {user ? (
              emailMismatch ? (
                <Link
                  href={`/login?redirect=${encodeURIComponent(postAuthRedirect)}&email=${encodeURIComponent(invitation?.email || '')}`}
                >
                  <Button className="w-full">
                    <LogIn className="mr-2 size-4" />
                    Sign in with {invitation?.email}
                  </Button>
                </Link>
              ) : (
                <Button
                  className="w-full"
                  onClick={handleAcceptInvitation}
                  disabled={accepting}
                >
                  {accepting ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Accepting…
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 size-4" />
                      Accept Invitation
                    </>
                  )}
                </Button>
              )
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-center text-muted-foreground">
                  Create an account to accept this invitation
                </p>
                <Link
                  href={`/signup?redirect=${encodeURIComponent(postAuthRedirect)}&email=${encodeURIComponent(invitation?.email || '')}&type=staff`}
                >
                  <Button className="w-full">Create Account</Button>
                </Link>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      Already have an account?
                    </span>
                  </div>
                </div>
                <Link
                  href={`/login?redirect=${encodeURIComponent(postAuthRedirect)}&email=${encodeURIComponent(invitation?.email || '')}`}
                >
                  <Button variant="outline" className="w-full">
                    <LogIn className="mr-2 size-4" />
                    Sign In
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Expiry Notice */}
          {invitation?.expiresAt && (
            <p className="text-xs text-center text-muted-foreground">
              This invitation expires on{' '}
              {new Date(invitation.expiresAt).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
