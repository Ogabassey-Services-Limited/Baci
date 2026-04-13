'use client';

import { createBrowserClient } from '@supabase/ssr';
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
import { useParams, useRouter } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

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
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading invitation...</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AcceptInvitePageContent() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [accepted, setAccepted] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
  );

  useEffect(() => {
    const checkAuthAndValidate = async () => {
      try {
        // Check if user is logged in
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser();
        if (currentUser?.email) {
          setUser({ email: currentUser.email });
        }

        // Validate the invitation token
        const response = await fetch(`/api/staff/accept-invite?token=${token}`);
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Invalid invitation');
          return;
        }

        setInvitation(data);
      } catch (err) {
        console.error('Error validating invitation:', err);
        setError('Failed to validate invitation');
      } finally {
        setLoading(false);
      }
    };

    checkAuthAndValidate();
  }, [token, supabase.auth]);

  const handleAcceptInvitation = async () => {
    if (!user) {
      // Redirect to login with return URL and pre-filled email
      const searchParams = new URLSearchParams({
        redirect: `/invite/${token}`,
        email: invitation?.email || '',
      });
      router.push(`/login?${searchParams.toString()}`);
      return;
    }

    setAccepting(true);
    try {
      const response = await fetch('/api/staff/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast({
          title: 'Error',
          description: data.error || 'Failed to accept invitation',
          variant: 'destructive',
        });
        return;
      }

      setAccepted(true);
      toast({
        title: 'Welcome to the team!',
        description: `You've joined ${invitation?.merchantName} as ${roleLabels[invitation?.role || ''] || invitation?.role}.`,
      });

      // Redirect to dashboard after a short delay
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    } catch (err) {
      console.error('Error accepting invitation:', err);
      toast({
        title: 'Error',
        description: 'Failed to accept invitation. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Validating invitation...</p>
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
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <XCircle className="h-6 w-6 text-red-600" />
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
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle>Welcome to the Team!</CardTitle>
            <CardDescription>
              You've successfully joined {invitation?.merchantName}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Redirecting you to the dashboard...
            </p>
            <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const emailMismatch =
    user &&
    invitation &&
    user.email.toLowerCase() !== invitation.email.toLowerCase();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Team Invitation</CardTitle>
          <CardDescription>You've been invited to join a team</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Invitation Details */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Store</p>
                <p className="font-medium">{invitation?.merchantName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Role</p>
                <p className="font-medium">
                  {roleLabels[invitation?.role || ''] || invitation?.role}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <Mail className="h-5 w-5 text-muted-foreground" />
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
                  href={`/login?redirect=/invite/${token}&email=${encodeURIComponent(invitation?.email || '')}`}
                >
                  <Button className="w-full">
                    <LogIn className="mr-2 h-4 w-4" />
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
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Accepting...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
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
                  href={`/signup?redirect=/invite/${token}&email=${encodeURIComponent(invitation?.email || '')}&type=staff`}
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
                  href={`/login?redirect=/invite/${token}&email=${encodeURIComponent(invitation?.email || '')}`}
                >
                  <Button variant="outline" className="w-full">
                    <LogIn className="mr-2 h-4 w-4" />
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
