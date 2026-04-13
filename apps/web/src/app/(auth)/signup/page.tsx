import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import SignupForm from '@/components/auth/signup-form';
import { createClient } from '@/lib/supabase/server';

// Signup is a per-request page (reads the session cookie and may redirect
// already-authenticated users). Opt out of static generation so `await cookies()`
// and the redirect happen in the top-level request scope, above any Suspense
// boundary, and don't trip Cache Components' "uncached data outside Suspense"
// guard during prerender.
export const dynamic = 'force-dynamic';

export default async function SignupPage() {
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
