import {
  createClient as createSupabaseClient,
  type SupabaseClient,
  type User,
} from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/env';
import { checkPasswordBreach } from '@/lib/password-breach';
import { resolveMerchantIdBySlugOrAlias } from '@/lib/resolve-merchant-by-slug';
import { isReservedMerchantSlug } from '@/lib/validation';

interface LegacyMobileSignupInput {
  request: NextRequest;
  email: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  slug?: string;
  slugIsCustom: boolean;
}

export type LegacyMobileSignupResult =
  | {
      ok: true;
      user: User;
      supabase: SupabaseClient;
      accountCreated: boolean;
    }
  | {
      ok: false;
      response: NextResponse;
    };

function createOnboardingClient(authorization: string | null): SupabaseClient {
  return createSupabaseClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    ...(authorization
      ? { global: { headers: { Authorization: authorization } } }
      : {}),
  });
}

function jsonError(error: string, status: number, code?: string): NextResponse {
  return NextResponse.json({ error, ...(code ? { code } : {}) }, { status });
}

async function preflightExplicitSlug(
  supabase: SupabaseClient,
  slug: string
): Promise<NextResponse | null> {
  const normalizedSlug = slug.trim().toLowerCase();
  if (normalizedSlug.length > 63 || isReservedMerchantSlug(normalizedSlug)) {
    return jsonError(
      'That store URL is unavailable. Please choose another.',
      409,
      'slug_unavailable'
    );
  }

  const preflight = await resolveMerchantIdBySlugOrAlias(
    supabase,
    normalizedSlug
  );
  if (preflight.error) {
    return jsonError(
      'Could not verify store URL availability. Please try again.',
      503
    );
  }
  if (preflight.merchantId) {
    return jsonError(
      'That store URL is unavailable. Please choose another.',
      409,
      'slug_unavailable'
    );
  }
  return null;
}

export async function runLegacyMobileSignup({
  request,
  email,
  password,
  firstName,
  lastName,
  slug,
  slugIsCustom,
}: LegacyMobileSignupInput): Promise<LegacyMobileSignupResult> {
  const authorization = request.headers.get('authorization');
  const bearerAuthorization = /^Bearer\s+\S+$/i.test(authorization ?? '')
    ? authorization
    : null;
  const initialClient = createOnboardingClient(bearerAuthorization);
  const {
    data: { user: currentUser },
  } = await initialClient.auth.getUser();

  if (currentUser) {
    return {
      ok: true,
      user: currentUser,
      supabase: initialClient,
      accountCreated: false,
    };
  }

  if (!password) {
    return {
      ok: false,
      response: jsonError('Password is required for new accounts.', 400),
    };
  }

  try {
    const { isBreached, count } = await checkPasswordBreach(password);
    if (isBreached) {
      return {
        ok: false,
        response: jsonError(
          `This password has appeared in ${(count ?? 1).toLocaleString()} known data breaches. Please choose a different, more secure password.`,
          400
        ),
      };
    }
  } catch (error) {
    console.error('mobile-onboarding password_breach_check_unavailable', error);
  }

  if (slugIsCustom && slug) {
    const preflightResponse = await preflightExplicitSlug(initialClient, slug);
    if (preflightResponse) {
      return { ok: false, response: preflightResponse };
    }
  }

  const fullName = [firstName, lastName].filter(Boolean).join(' ') || undefined;
  const { data, error } = await initialClient.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  if (error) {
    if (error.message.includes('already registered')) {
      return {
        ok: false,
        response: jsonError(
          'User already exists. Please log in.',
          409,
          'account_exists'
        ),
      };
    }
    if (error.status === 429 || error.message.includes('security purposes')) {
      return {
        ok: false,
        response: jsonError(
          'Too many attempts. Please wait a minute and try again.',
          429
        ),
      };
    }
    throw error;
  }

  if (!data.user) {
    return {
      ok: false,
      response: jsonError('Signup failed. Please try again.', 500),
    };
  }
  if (!data.session?.access_token) {
    return {
      ok: false,
      response: jsonError(
        'Please confirm your email to finish onboarding and sign in again.',
        403,
        'EMAIL_CONFIRMATION_REQUIRED'
      ),
    };
  }

  return {
    ok: true,
    user: data.user,
    supabase: createOnboardingClient(`Bearer ${data.session.access_token}`),
    accountCreated: true,
  };
}
