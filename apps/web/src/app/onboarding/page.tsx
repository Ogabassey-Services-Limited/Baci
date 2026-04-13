import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import OnboardingPageContent from './onboarding-page-content';

function OnboardingPageFallback() {
  return (
    <div
      className="flex min-h-screen items-center justify-center text-sm text-muted-foreground"
      role="status"
    >
      Loading onboarding...
    </div>
  );
}

export async function OnboardingPageContentServer() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // Check for existing session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // Check if user already has a merchant account
    const { data: merchant } = await supabase
      .from('merchants')
      .select('id, business_name')
      .eq('user_id', user.id)
      .maybeSingle();

    if (merchant?.business_name) {
      // Redirect to dashboard if merchant exists AND is fully set up
      redirect('/dashboard');
    }
  }

  return <OnboardingPageContent />;
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<OnboardingPageFallback />}>
      <OnboardingPageContentServer />
    </Suspense>
  );
}
