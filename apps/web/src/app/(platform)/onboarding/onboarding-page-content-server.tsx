import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import OnboardingPageContent from './onboarding-page-content';

export async function OnboardingPageContentServer() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: merchant } = await supabase
      .from('merchants')
      .select('id, business_name')
      .eq('user_id', user.id)
      .maybeSingle();

    if (merchant?.business_name) {
      redirect('/dashboard');
    }
  }

  return <OnboardingPageContent />;
}
