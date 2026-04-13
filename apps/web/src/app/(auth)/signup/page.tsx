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
