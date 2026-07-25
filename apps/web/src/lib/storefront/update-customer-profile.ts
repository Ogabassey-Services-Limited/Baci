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
 * CSRF is enforced by the origin-based middleware in `proxy.ts` for this guest
 * storefront route; callers own the local state update on success.
 */
export async function updateCustomerProfile(
  merchantSlug: string,
  updates: Record<string, unknown>
): Promise<UpdateCustomerProfileResult> {
  try {
    const response = await fetch('/api/storefront/customer', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...updates, merchantSlug }),
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
