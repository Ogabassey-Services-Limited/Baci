import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import OnboardingPageContent from './onboarding-page-content';

export default async function OnboardingPage() {
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

    if (merchant && merchant.business_name) {
      // Redirect to dashboard if merchant exists AND is fully set up
      redirect('/dashboard');
    }
  }

  return <OnboardingPageContent />;
}

