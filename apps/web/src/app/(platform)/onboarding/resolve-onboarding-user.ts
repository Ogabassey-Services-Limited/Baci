import type { User } from '@supabase/supabase-js';
import type { createClient as createServerClient } from '@/lib/supabase/server';

type OnboardingAuthClient = Pick<
  Awaited<ReturnType<typeof createServerClient>>,
  'auth'
>;

interface ResolveOnboardingUserInput {
  businessName: string;
  email: string;
  onNewSession: () => void;
  password?: string;
  redirectUrl: string;
  supabase: OnboardingAuthClient;
}

export type OnboardingUserResolution =
  | { status: 'resolved'; user: User }
  | { status: 'message'; message: string };

const LOGIN_GUIDANCE =
  'An account may already exist. Please log in to continue.';
const ACCOUNT_VERIFICATION_GUIDANCE =
  'Could not verify your account. Please try again.';

function loginGuidance(): OnboardingUserResolution {
  return { status: 'message', message: LOGIN_GUIDANCE };
}

export async function resolveOnboardingUser({
  businessName: _businessName,
  email,
  onNewSession,
  password,
  redirectUrl,
  supabase,
}: ResolveOnboardingUserInput): Promise<OnboardingUserResolution> {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (authUser) {
    if (authUser.email?.toLowerCase() === email.toLowerCase()) {
      return { status: 'resolved', user: authUser };
    }
    return {
      status: 'message',
      message: 'Please sign in with the account used for this store setup.',
    };
  }

  if (!password) return loginGuidance();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (!error && data.user) return { status: 'resolved', user: data.user };
  if (!error)
    return { status: 'message', message: ACCOUNT_VERIFICATION_GUIDANCE };
  if (!error.message.includes('Invalid login credentials'))
    return { status: 'message', message: ACCOUNT_VERIFICATION_GUIDANCE };

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: redirectUrl },
  });
  if (signUpError) return loginGuidance();
  if (!signUpData.session || !signUpData.user) return loginGuidance();
  onNewSession();
  return { status: 'resolved', user: signUpData.user };
}
