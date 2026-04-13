import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import SignupForm from '@/components/auth/signup-form';
import { createClient } from '@/lib/supabase/server';

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
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
