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
    if (!password) {
      return {
        status: 'message',
        message: `You are logged in as ${authUser.email}. Please log out first, or enter a password to create a new account with ${email}.`,
      };
    }
    await supabase.auth.signOut();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectUrl },
    });
    if (error) throw error;
    if (!data.session || !data.user) {
      throw new Error('Please disable "Confirm Email" in Supabase settings.');
    }
    onNewSession();
    return { status: 'resolved', user: data.user };
  }

  if (!password) throw new Error('Authentication failed.');
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (!error && data.user) return { status: 'resolved', user: data.user };
  if (!error) throw new Error('Authentication failed.');
  if (!error.message.includes('Invalid login credentials')) throw error;

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: redirectUrl },
  });
  if (signUpError) throw signUpError;
  if (!signUpData.session || !signUpData.user) {
    throw new Error('Please disable "Confirm Email" in Supabase settings.');
  }
  onNewSession();
  return { status: 'resolved', user: signUpData.user };
}
