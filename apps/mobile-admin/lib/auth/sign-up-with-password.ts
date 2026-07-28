/**
 * Account-only email/password sign-up.
 *
 * This is the shared account primitive for merchant and staff registration. It
 * creates and commits only the Supabase Auth identity/session; the caller
 * decides whether authenticated merchant provisioning follows. Keeping this
 * primitive account-only is essential for staff invite acceptance.
 *
 * NOTE: this relies on there being NO auth.users trigger that creates a
 * merchant. handle_new_user() is currently a no-op; if that ever changes this
 * flow silently regresses. See sign-up-with-password.test.ts.
 */

import { isAuthApiError, type Session, type User } from '@supabase/supabase-js';
import { isConnectivityError } from '@/lib/api-errors';
import { checkPasswordBreach } from '@/lib/auth/check-password-breach';
import { supabase } from '@/lib/supabase';
import { trackAuthTelemetry } from '@/services/auth-telemetry';

export interface PasswordSignUpResult {
  error: string | null;
  /** Email already has an account — caller should route to sign-in. */
  accountExists?: boolean;
  /** New account created but a session was not returned (email confirmation on). */
  needsEmailConfirmation?: boolean;
  /** A native session was committed to the global auth store. */
  sessionEstablished?: boolean;
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
  firstName?: string;
  lastName?: string;
  fullName?: string;
  getCurrentUserId: () => string | undefined;
  onResetUserStores: () => Promise<void>;
  setState: (state: SignUpStateUpdate) => void;
}

function isRateLimited(message: string, status: number | undefined): boolean {
  return (
    status === 429 || /rate limit|for security purposes|too many/i.test(message)
  );
}

function isAlreadyRegistered(message: string): boolean {
  return /already registered|already been registered|user already exists/i.test(
    message
  );
}

function toSentenceCase(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  if (!normalized) {
    return undefined;
  }
  return `${normalized.charAt(0).toUpperCase()}${normalized
    .slice(1)
    .toLowerCase()}`;
}

export async function runPasswordSignUp({
  email,
  password,
  firstName,
  lastName,
  fullName,
  getCurrentUserId,
  onResetUserStores,
  setState,
}: RunPasswordSignUpOptions): Promise<PasswordSignUpResult> {
  const startedAt = Date.now();
  setState({ activeAuthProvider: 'password', isAuthenticating: true });
  trackAuthTelemetry({ provider: 'password', stage: 'start' });

  try {
    const { count, isBreached } = await checkPasswordBreach(password);
    if (isBreached) {
      trackAuthTelemetry({
        code: 'password_breached',
        durationMs: Date.now() - startedAt,
        provider: 'password',
        stage: 'failure',
      });
      return {
        error: `This password has appeared in ${(count ?? 1).toLocaleString()} known data breaches. Please choose a different, more secure password.`,
      };
    }

    const normalizedFirstName = toSentenceCase(firstName);
    const normalizedLastName = toSentenceCase(lastName);
    const normalizedFullName =
      [normalizedFirstName, normalizedLastName].filter(Boolean).join(' ') ||
      fullName
        ?.trim()
        .split(/\s+/)
        .map((part) => toSentenceCase(part))
        .filter(Boolean)
        .join(' ');
    const metadata = {
      ...(normalizedFirstName ? { first_name: normalizedFirstName } : {}),
      ...(normalizedLastName ? { last_name: normalizedLastName } : {}),
      ...(normalizedFullName ? { full_name: normalizedFullName } : {}),
    };
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options:
        Object.keys(metadata).length > 0 ? { data: metadata } : undefined,
    });

    if (error) {
      const status = isAuthApiError(error) ? error.status : undefined;
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
      if (currentUserId !== data.user.id) {
        await onResetUserStores();
      }
      setState({
        session: data.session,
        user: data.user,
        isAuthenticated: true,
        isInitialized: true,
        isLoading: false,
      });
      trackAuthTelemetry({
        durationMs: Date.now() - startedAt,
        metadata: { hasSession: true },
        provider: 'password',
        stage: 'success',
      });
      return { error: null, sessionEstablished: true };
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
    const message = isConnectivityError(caught)
      ? 'Unable to connect. Please check your internet connection.'
      : caught instanceof Error
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
