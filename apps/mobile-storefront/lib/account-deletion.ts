import type { User } from '@supabase/supabase-js';

export interface DeleteAccountResult {
  success: boolean;
  error?: string;
  usedApple?: boolean;
}

interface ErrorWithMessage {
  message?: unknown;
}

function getErrorMessage(error: unknown): string | null {
  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object') {
    const maybeError = error as ErrorWithMessage;
    if (typeof maybeError.message === 'string') {
      return maybeError.message;
    }
  }

  return null;
}

const SESSION_EXPIRED_MESSAGE =
  'Your session expired. Please sign in again and retry account deletion.';
const TEMPORARY_UNAVAILABLE_MESSAGE =
  'Account deletion is temporarily unavailable. Please contact support.';
const NETWORK_RETRY_MESSAGE =
  "We couldn't reach the server. Check your connection and try again.";
const FALLBACK_DELETE_ERROR_MESSAGE =
  'Unable to delete your account right now. Please try again.';

export function hasAppleProvider(
  user: Pick<User, 'app_metadata' | 'identities'> | null | undefined
): boolean {
  if (!user) {
    return false;
  }

  const providers = new Set<string>();

  const appProvider = user.app_metadata?.provider;
  if (typeof appProvider === 'string') {
    providers.add(appProvider.toLowerCase());
  }

  const appProviders = user.app_metadata?.providers;
  if (Array.isArray(appProviders)) {
    for (const provider of appProviders) {
      if (typeof provider === 'string') {
        providers.add(provider.toLowerCase());
      }
    }
  }

  if (Array.isArray(user.identities)) {
    for (const identity of user.identities) {
      if (identity && typeof identity.provider === 'string') {
        providers.add(identity.provider.toLowerCase());
      }
    }
  }

  return providers.has('apple');
}

export function getDeleteAccountErrorMessage(error: unknown): string {
  const message = getErrorMessage(error);

  if (!message) {
    return FALLBACK_DELETE_ERROR_MESSAGE;
  }

  const normalized = message.toLowerCase();

  if (
    normalized.includes('unauthorized') ||
    normalized.includes('jwt') ||
    normalized.includes('auth session')
  ) {
    return SESSION_EXPIRED_MESSAGE;
  }

  if (
    normalized.includes('network') ||
    normalized.includes('timeout') ||
    normalized.includes('timed out')
  ) {
    return NETWORK_RETRY_MESSAGE;
  }

  if (
    normalized.includes('delete_current_storefront_account') ||
    normalized.includes('failed to delete account') ||
    normalized.includes('account email not found') ||
    normalized.includes('foreign key constraint') ||
    normalized.includes('relation "') ||
    normalized.includes('column "') ||
    normalized.includes('permission denied') ||
    normalized.includes('syntax error')
  ) {
    return TEMPORARY_UNAVAILABLE_MESSAGE;
  }

  return FALLBACK_DELETE_ERROR_MESSAGE;
}
