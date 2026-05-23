import Link from 'next/link';
import { Logo } from '@/components/logo';
import { ThemedButton } from '@/components/themed/themed-button';
import { ThemedCard } from '@/components/themed/themed-card';

export interface ErrorPageProps {
  title: string;
  message: string;
  showLoginLink?: boolean;
  currentEmail?: string;
}

export default function ErrorPage({
  title,
  message,
  showLoginLink = false,
  currentEmail,
}: ErrorPageProps) {
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
