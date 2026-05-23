import Link from 'next/link';
import { Logo } from '@/components/logo';
import { ThemedButton } from '@/components/themed/themed-button';
import { ThemedCard } from '@/components/themed/themed-card';

export interface InvitePageProps {
  merchantName: string;
  role: string;
  inviteEmail: string;
  token: string;
}

export default function InvitePage({
  merchantName,
  role,
  inviteEmail,
  token,
}: InvitePageProps) {
  const encodedToken = encodeURIComponent(token);
  const encodedEmail = encodeURIComponent(inviteEmail);
  const encodedRedirect = encodeURIComponent(
    `/staff/accept?token=${encodedToken}`
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5 p-4">
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
          <Link href={`/login?redirect=${encodedRedirect}`}>
            <ThemedButton className="w-full" size="lg">
              Sign In to Accept
            </ThemedButton>
          </Link>

          <p className="text-xs text-center text-muted-foreground">
            Don't have an account?{' '}
            <Link
              href={`/signup?email=${encodedEmail}&redirect=${encodedRedirect}`}
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
