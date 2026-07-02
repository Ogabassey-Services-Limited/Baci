/**
 * Account-only email/password sign-up.
 *
 * Unlike merchant registration (POST /api/mobile-onboarding, which provisions a
 * merchant + subdomain + owner staff row), this calls supabase.auth.signUp
 * directly and creates ONLY an auth.users row — no merchant. That is essential
 * for the staff-invite flow: get_user_merchant_context resolves an owned
 * merchant before staff membership, so if an invitee owned a store they would
 * be pinned to it and never reach the store they were invited to. Creating no
 * merchant lets the RPC's staff fallback return the invited store.
 *
 * NOTE: this relies on there being NO auth.users trigger that creates a
 * merchant. handle_new_user() is currently a no-op; if that ever changes this
 * flow silently regresses. See sign-up-with-password.test.ts.
 */

import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { trackAuthTelemetry } from '@/services/auth-telemetry';

export interface PasswordSignUpResult {
  error: string | null;
  /** Email already has an account — caller should route to sign-in. */
  accountExists?: boolean;
  /** New account created but a session was not returned (email confirmation on). */
  needsEmailConfirmation?: boolean;
}

interface SignUpStateUpdate {
  activeAuthProvider?: 'password' | null;
  isAuthenticating?: boolean;
  session?: Session | null;
  user?: User | null;
  isAuthenticated?: boolean;
  isInitialized?: boolean;
  isLoading?: boolean;
}

interface RunPasswordSignUpOptions {
  email: string;
  password: string;
  fullName?: string;
  getCurrentUserId: () => string | undefined;
  onResetUserStores: () => void;
  setState: (state: SignUpStateUpdate) => void;
}

function isRateLimited(message: string, status: number | undefined): boolean {
  return (
    status === 429 ||
    /rate limit|for security purposes|too many/i.test(message)
  );
}

function isAlreadyRegistered(message: string): boolean {
  return /already registered|already been registered|user already exists/i.test(
    message
  );
}

export async function runPasswordSignUp({
  email,
  password,
  fullName,
  getCurrentUserId,
  onResetUserStores,
  setState,
}: RunPasswordSignUpOptions): Promise<PasswordSignUpResult> {
  const startedAt = Date.now();
  setState({ activeAuthProvider: 'password', isAuthenticating: true });
  trackAuthTelemetry({ provider: 'password', stage: 'start' });

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: fullName ? { data: { full_name: fullName } } : undefined,
    });

    if (error) {
      const status = (error as { status?: number }).status;
      if (isRateLimited(error.message, status)) {
        trackAuthTelemetry({
          code: 'password_signup_rate_limited',
          durationMs: Date.now() - startedAt,
          provider: 'password',
          stage: 'failure',
        });
        return {
          error: 'Too many attempts. Please wait a minute and try again.',
        };
      }
      // Treat an existing account as a non-error so the caller can redirect to
      // sign-in without leaking whether the email is registered.
      if (isAlreadyRegistered(error.message)) {
        return { error: null, accountExists: true };
      }
      trackAuthTelemetry({
        code: 'password_signup_error',
        durationMs: Date.now() - startedAt,
        provider: 'password',
        stage: 'failure',
      });
      return { error: error.message };
    }

    // Anti-enumeration: when confirmation is enabled, signing up an existing
    // email returns a user with an empty identities array and no session.
    if (
      data.user &&
      Array.isArray(data.user.identities) &&
      data.user.identities.length === 0
    ) {
      return { error: null, accountExists: true };
    }

    if (data.session && data.user) {
      const currentUserId = getCurrentUserId();
      setState({
        session: data.session,
        user: data.user,
        isAuthenticated: true,
        isInitialized: true,
        isLoading: false,
      });
      if (currentUserId !== data.user.id) {
        onResetUserStores();
      }
      trackAuthTelemetry({
        durationMs: Date.now() - startedAt,
        metadata: { hasSession: true },
        provider: 'password',
        stage: 'success',
      });
      return { error: null };
    }

    // New account created but no session — email confirmation is required.
    trackAuthTelemetry({
      durationMs: Date.now() - startedAt,
      metadata: { hasSession: false },
      provider: 'password',
      stage: 'success',
    });
    return { error: null, needsEmailConfirmation: true };
  } catch (caught) {
    const message =
      caught instanceof Error
        ? caught.message
        : 'Sign-up failed. Please try again.';
    trackAuthTelemetry({
      code: 'password_signup_unknown_error',
      durationMs: Date.now() - startedAt,
      provider: 'password',
      stage: 'failure',
    });
    return { error: message };
  } finally {
    setState({ activeAuthProvider: null, isAuthenticating: false });
  }
}
