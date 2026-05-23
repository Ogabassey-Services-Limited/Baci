import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import SignupForm from '@/components/auth/signup-form';
import { createClient } from '@/lib/supabase/server';

function SignupLoadingFallback() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="flex min-h-[50vh] items-center justify-center"
      role="status"
    >
      <span className="sr-only">Loading sign up…</span>
      <div
        aria-hidden="true"
        className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary"
      />
    </div>
  );
}

// Cache Components mode disallows `export const dynamic = 'force-dynamic'`,
// so the only way to satisfy the prerender's "uncached data outside Suspense"
// guard is to wrap the request-scoped work (await cookies(), auth check,
// redirect) in a Suspense boundary. The redirect() call inside throws
// NEXT_REDIRECT which is an Error (not a thenable), so it bubbles past
// Suspense and is handled by Next.js as a normal server-side redirect.
export default function SignupPage() {
  return (
    <Suspense fallback={<SignupLoadingFallback />}>
      <SignupPageContent />
    </Suspense>
  );
}

async function SignupPageContent() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // Check if user is already logged in
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // If logged in, redirect to dashboard by default
    // The middleware or client-side logic can handle specific redirects if needed
    redirect('/dashboard');
  }

  return <SignupForm />;
}
