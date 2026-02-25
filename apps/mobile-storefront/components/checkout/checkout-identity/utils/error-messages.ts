/**
 * Error Message Utilities
 *
 * 2026 Best Practices:
 * - User-friendly error messages
 * - Centralized error mapping
 * - i18n-ready structure
 */

/**
 * User-friendly error messages for common Supabase auth errors
 */
export const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'Invalid login credentials': 'Incorrect email or password. Please try again.',
  'Email not confirmed': 'Please verify your email address before signing in.',
  'Too many requests': 'Too many attempts. Please wait a moment and try again.',
  'Network request failed': 'Connection error. Please check your internet.',
  'User not found': 'No account found with this email address.',
  'Invalid email': 'Please enter a valid email address.',
  'Password is too short': 'Password must be at least 6 characters.',
  'Email rate limit exceeded':
    'Too many email requests. Please try again later.',
} as const;

/**
 * Default error message when no specific match is found
 */
export const DEFAULT_ERROR_MESSAGE = 'Something went wrong. Please try again.';

/**
 * Transforms a Supabase auth error into a user-friendly message
 *
 * @param error - The error object or unknown value
 * @returns A user-friendly error message string
 */
export function getUserFriendlyError(error: Error | unknown): string {
  if (!(error instanceof Error)) {
    return DEFAULT_ERROR_MESSAGE;
  }

  const message = error.message;

  // Check for known error patterns (case-insensitive)
  for (const [key, friendlyMessage] of Object.entries(AUTH_ERROR_MESSAGES)) {
    if (message.toLowerCase().includes(key.toLowerCase())) {
      return friendlyMessage;
    }
  }

  // Return the original message if it's reasonable, otherwise default
  return message || DEFAULT_ERROR_MESSAGE;
}

/**
 * Social sign-in specific error messages
 */
export const SOCIAL_ERROR_MESSAGES = {
  google: 'Google sign-in failed. Please try again.',
  apple: 'Apple sign-in failed. Please try again.',
  cancelled: 'Sign in was cancelled',
} as const;

/**
 * Form validation error messages
 */
export const VALIDATION_ERROR_MESSAGES = {
  emailRequired: 'Please enter your email address',
  emailInvalid: 'Please enter a valid email address',
  passwordRequired: 'Please enter your password',
  passwordTooShort: 'Password must be at least 6 characters',
} as const;
