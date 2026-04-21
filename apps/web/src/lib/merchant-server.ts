import type { User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { cache } from 'react';
import {
  fetchDashboardMerchant,
  fetchPrimaryDomain,
  type MerchantData,
  type StaffAccess,
} from '@/hooks/merchant';
import { createClient } from '@/lib/supabase/server';

const defaultStaffAccess: StaffAccess = {
  isStaff: false,
  isOwner: false,
  role: null,
  permissions: {},
};

export type MerchantLookupStatus =
  | 'found'
  | 'not_found'
  | 'unauthenticated'
  | 'error';

type MerchantForUserResult = {
  merchant: MerchantData | null;
  merchantLookupStatus: MerchantLookupStatus;
  staffAccess: StaffAccess;
  user: User | null;
};

// Use React cache() to deduplicate this call within a single request
// This means layout.tsx and page.tsx will share the same result
export const getMerchantForUser = cache(
  async (): Promise<MerchantForUserResult> => {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      return {
        merchant: null,
        merchantLookupStatus: 'error',
        staffAccess: defaultStaffAccess,
        user: null,
      };
    }

    if (!user) {
      return {
        merchant: null,
        merchantLookupStatus: 'unauthenticated',
        staffAccess: defaultStaffAccess,
        user: null,
      };
    }

    try {
      const { merchant: merchantData, staffAccess: access } =
        await fetchDashboardMerchant(supabase, user.id);

      // If we found a merchant, fetch their primary domain
      if (merchantData) {
        const primaryDomain = await fetchPrimaryDomain(
          supabase,
          merchantData.id
        );
        if (primaryDomain) {
          merchantData.custom_domain = primaryDomain;
        }
      }

      return {
        merchant: merchantData,
        merchantLookupStatus: merchantData ? 'found' : 'not_found',
        staffAccess: access,
        user,
      };
    } catch (error) {
      console.error('Failed to load merchant data server-side:', error);
      return {
        merchant: null,
        merchantLookupStatus: 'error',
        staffAccess: defaultStaffAccess,
        user,
      };
    }
  }
);

/**
 * Ensure the current user has a specific permission for a resource.
 * Throws an error if:
 * - User is not authenticated
 * - User has no merchant access
 * - User lacks the required permission
 *
 * @param resource - The resource to check (e.g., 'staff', 'products', 'orders')
 * @param action - The action to check (e.g., 'view', 'edit', 'invite', 'remove')
 * @returns The merchant and staff access if authorized
 * @throws Error if not authorized
 */
export async function ensurePermission(
  resource: string,
  action: string
): Promise<{ merchant: MerchantData; staffAccess: StaffAccess }> {
  const { merchant, staffAccess, user } = await getMerchantForUser();

  if (!user) {
    throw new Error('Authentication required');
  }

  if (!merchant) {
    throw new Error('No merchant access');
  }

  // Owners have full access
  if (staffAccess.isOwner) {
    return { merchant, staffAccess };
  }

  // Check full_access permission
  if (staffAccess.permissions?.full_access?.all) {
    return { merchant, staffAccess };
  }

  // Check specific permission
  const resourcePermissions = staffAccess.permissions?.[resource];
  if (!resourcePermissions?.[action] && !resourcePermissions?.all) {
    throw new Error(
      `Permission denied: ${action} access to ${resource} is required`
    );
  }

  return { merchant, staffAccess };
}
