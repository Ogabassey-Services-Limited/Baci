// Friendly error-message maps for the profile-write RPCs. Both
// set_customer_username and set_customer_date_of_birth raise their failure
// reason as the Postgres error message; these map those codes to shopper-facing
// copy. Extracted from auth-store-account.ts to keep that module under the
// 300-line module-size gate.

const USERNAME_ERROR_MESSAGES: Record<string, string> = {
  username_taken: 'That username is already taken. Try another.',
  reserved_username: 'That username is not available.',
  invalid_username:
    'Use 3-20 letters, numbers, or single . _ separators (start and end with a letter or number).',
  customer_not_found: 'No shopper account found for this store.',
  not_authenticated: 'Please sign in to choose a username.',
};

const DATE_OF_BIRTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_date_of_birth: 'Enter a valid date of birth.',
  customer_not_found: 'No shopper account found for this store.',
  not_authenticated: 'Please sign in to continue.',
};

/**
 * Single primary export: maps a profile-write RPC's raised Postgres error
 * message to shopper-facing copy, one mapper per RPC.
 */
export const profileRpcErrorMessages = {
  username(message: string): string {
    return USERNAME_ERROR_MESSAGES[message] ?? 'Could not set username';
  },
  dateOfBirth(message: string): string {
    return (
      DATE_OF_BIRTH_ERROR_MESSAGES[message] ?? 'Could not save date of birth'
    );
  },
};
