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

function isDuplicateSignupError(error: {
  code?: string;
  message: string;
}): boolean {
  return (
    error.code === 'user_already_exists' ||
    /already\s+(exists|registered)|user\s+already/i.test(error.message)
  );
}

export async function resolveOnboardingUser({
  businessName: _businessName,
  email,
  onNewSession,
  password,
  redirectUrl,
  supabase,
}: ResolveOnboardingUserInput): Promise<OnboardingUserResolution> {
  const session = await supabase.auth.getUser();
  if (session.error)
    return { status: 'message', message: ACCOUNT_VERIFICATION_GUIDANCE };
  const authUser = session.data.user;
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
  if (signUpError)
    return isDuplicateSignupError(signUpError)
      ? loginGuidance()
      : { status: 'message', message: ACCOUNT_VERIFICATION_GUIDANCE };
  if (!signUpData.session || !signUpData.user) return loginGuidance();
  onNewSession();
  return { status: 'resolved', user: signUpData.user };
}
