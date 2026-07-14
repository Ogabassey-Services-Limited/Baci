import type { User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { cache } from 'react';
import {
  fetchDashboardMerchant,
  fetchPrimaryDomain,
  type MerchantData,
  type StaffAccess,
} from '@/hooks/merchant';
import { permissionGrantsAccess } from '@/lib/permission-grant';
import { createAdminClient } from '@/lib/supabase/admin';
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

export class MerchantAuthenticationRequiredError extends Error {
  constructor() {
    super('Authentication required');
    this.name = 'MerchantAuthenticationRequiredError';
  }
}

export class NoMerchantAccessError extends Error {
  constructor() {
    super('No merchant access');
    this.name = 'NoMerchantAccessError';
  }
}

export class MerchantPermissionDeniedError extends Error {
  constructor(resource: string, action: string) {
    super(`Permission denied: ${action} access to ${resource} is required`);
    this.name = 'MerchantPermissionDeniedError';
  }
}

export function isMerchantPermissionRedirectError(
  error: unknown
): error is
  | MerchantAuthenticationRequiredError
  | NoMerchantAccessError
  | MerchantPermissionDeniedError {
  return (
    error instanceof MerchantAuthenticationRequiredError ||
    error instanceof NoMerchantAccessError ||
    error instanceof MerchantPermissionDeniedError
  );
}

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
      // Auth was verified above with the cookie-bound client. The own-merchant
      // read runs under the service role because S1 revokes the sensitive
      // `merchants` column grants from the `authenticated` role; ownership is
      // still enforced by the `user_id = user.id` scoping inside
      // fetchDashboardMerchant.
      const admin = createAdminClient();
      const { merchant: merchantData, staffAccess: access } =
        await fetchDashboardMerchant(admin, user.id);

      // If we found a merchant, fetch their primary domain
      if (merchantData) {
        const primaryDomain = await fetchPrimaryDomain(admin, merchantData.id);
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
    throw new MerchantAuthenticationRequiredError();
  }

  if (!merchant) {
    throw new NoMerchantAccessError();
  }

  // Owners have full access
  if (staffAccess.isOwner) {
    return { merchant, staffAccess };
  }

  if (!permissionGrantsAccess(staffAccess.permissions, resource, action)) {
    throw new MerchantPermissionDeniedError(resource, action);
  }

  return { merchant, staffAccess };
}
