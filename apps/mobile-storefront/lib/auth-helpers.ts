/**
 * Auth Store Helpers
 * Extracted utility functions for authentication store
 */

/**
 * Safe name splitting with validation
 * Safely splits a full name into first and last name with validation
 */
export function splitFullName(fullName: unknown): {
  firstName: string;
  lastName: string;
} {
  let firstName = '';
  let lastName = '';

  if (typeof fullName === 'string' && fullName.trim()) {
    const nameParts = fullName.trim().split(/\s+/); // Split by whitespace
    firstName = nameParts[0] || '';
    lastName = nameParts.slice(1).join(' ') || '';
  }

  return { firstName, lastName };
}
