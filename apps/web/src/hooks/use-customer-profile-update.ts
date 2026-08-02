import type { Dispatch, SetStateAction } from 'react';
import type { Customer, CustomerUser } from '@/contexts/customer-auth-context';
import { updateCustomerProfile } from '@/lib/storefront/update-customer-profile';

type UseCustomerProfileUpdateArgs = {
  customer: Customer | null;
  user: CustomerUser | null;
  merchantSlug: string;
  setCustomer: Dispatch<SetStateAction<Customer | null>>;
};

/**
 * Returns the `updateCustomer` action for the storefront profile (name, phone,
 * saved addresses, quiz DOB). Extracted from `CustomerAuthContext` so this
 * write-orchestration lives in a focused, testable unit rather than growing the
 * oversized provider.
 *
 * Identity safety (cookies are ambient): the shopper is snapshotted before the
 * await, forwarded as `expected_user_id` so the server rejects a mid-write
 * account switch (409), and the local `setCustomer` merge is guarded against the
 * LIVE `prev` state — if the account switched, `prev` is a different customer
 * and the merge is skipped, so one shopper's data can't fold into another's.
 */
export function useCustomerProfileUpdate({
  customer,
  user,
  merchantSlug,
  setCustomer,
}: UseCustomerProfileUpdateArgs) {
  return async (
    data: Partial<Customer>
  ): Promise<{ success: boolean; error?: string }> => {
    if (!customer) {
      return { success: false, error: 'Not authenticated' };
    }

    const expectedUserId = user?.id;
    const expectedCustomerId = customer.id;

    const result = await updateCustomerProfile(
      merchantSlug,
      data,
      expectedUserId
    );
    if (result.success) {
      setCustomer((prev) =>
        prev && prev.id === expectedCustomerId ? { ...prev, ...data } : prev
      );
    }
    return result;
  };
}
