import { fetchWithCsrf } from '@/lib/api-client';

export type UpdateCustomerProfileResult = {
  success: boolean;
  error?: string;
};

/**
 * PATCHes the signed-in shopper's storefront profile (name, phone, saved
 * addresses, and the `date_of_birth` captured by the quiz 18+ age gate).
 *
 * Extracted from `CustomerAuthContext` so the profile-write concern lives in a
 * focused, testable module rather than growing the oversized context file.
 * Uses `fetchWithCsrf` so the double-submit CSRF token is attached (and
 * refreshed/retried on a 403) — the server route now enforces it. Callers own
 * the local state update on success.
 */
export async function updateCustomerProfile(
  merchantSlug: string,
  updates: Record<string, unknown>,
  /**
   * The auth user id the caller intends to write for. Forwarded to the server,
   * which rejects (409) if the cookie session has since switched — so a stale
   * write (e.g. a deferred quiz DOB save) cannot land on another account.
   */
  expectedUserId?: string
): Promise<UpdateCustomerProfileResult> {
  try {
    const response = await fetchWithCsrf('/api/storefront/customer', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...updates,
        merchantSlug,
        ...(expectedUserId ? { expected_user_id: expectedUserId } : {}),
      }),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        success: false,
        error:
          typeof result?.error === 'string' ? result.error : 'Update failed',
      };
    }

    return { success: true };
  } catch (error) {
    console.error('Update customer error:', error);
    return { success: false, error: 'Network error. Please try again.' };
  }
}
