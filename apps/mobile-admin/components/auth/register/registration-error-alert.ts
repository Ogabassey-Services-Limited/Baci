import type { NetworkError } from '@/lib/api-client';

/**
 * Maps a registration failure to the alert the user should see.
 *
 * Extracted from RegisterScreen so the routing decisions are unit-testable on
 * their own and the screen stays inside the 300-line limit. Pure: it names an
 * intent (`action`) instead of navigating, and the screen binds that to the
 * router.
 */

export type RegistrationErrorAction = 'login' | 'dismiss';

export interface RegistrationErrorAlertButton {
  text: string;
  action: RegistrationErrorAction;
  style?: 'cancel';
}

export interface RegistrationErrorAlert {
  title: string;
  message: string;
  /** Empty means a plain one-button alert (Alert.alert with no button list). */
  buttons: RegistrationErrorAlertButton[];
}

const GENERIC_FALLBACK = 'Please try again later.';

const TIMEOUT_MESSAGE =
  'The server is taking too long to respond. Please check your connection and try again.';

const OFFLINE_MESSAGE =
  'Could not reach the server. Please check your internet connection and try again.';

const ACCOUNT_CREATED_FALLBACK =
  'Your account was created, but we could not finish setting up your store. Please sign in to finish setup.';

export function resolveRegistrationErrorAlert(
  error: Error
): RegistrationErrorAlert {
  const networkError = error as NetworkError;
  const errorCode = (networkError.data as { code?: string } | undefined)?.code;

  if (networkError.statusCode === 409) {
    // The user's chosen Store Link is taken/retired — offer to pick another,
    // NOT "go to login", which would be the wrong recovery.
    if (errorCode === 'slug_unavailable') {
      return {
        title: 'Store URL Unavailable',
        message:
          'That store URL is already taken. Please choose a different one.',
        buttons: [],
      };
    }

    return {
      title: 'Account Exists',
      message:
        'An account with this email already exists. Please log in instead.',
      buttons: [
        { text: 'Go to Login', action: 'login' },
        { text: 'OK', action: 'dismiss', style: 'cancel' },
      ],
    };
  }

  if (networkError.statusCode === 429) {
    return {
      title: 'Too Many Attempts',
      message: 'Please wait a minute before trying again.',
      buttons: [],
    };
  }

  // The account WAS created but store provisioning failed. Retrying
  // registration re-runs the same failing path — and once the signup session is
  // cached the server skips signUp entirely, so the user never even gets the
  // "account exists" 409. Sign-in routes a merchant-less user to
  // complete-profile.
  if (errorCode === 'account_created_store_setup_failed') {
    return {
      title: 'Finish Setting Up',
      message: error.message || ACCOUNT_CREATED_FALLBACK,
      buttons: [{ text: 'Sign In', action: 'login' }],
    };
  }

  let message = error.message || GENERIC_FALLBACK;
  if (networkError.isTimeout) {
    message = TIMEOUT_MESSAGE;
  } else if (networkError.isOffline) {
    message = OFFLINE_MESSAGE;
  }

  return { title: 'Registration Failed', message, buttons: [] };
}
