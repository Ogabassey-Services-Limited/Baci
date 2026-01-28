import { cookies } from 'next/headers';
import { cache } from 'react';
import type {
  MerchantData,
  StaffAccess,
  StaffRole,
} from '@/hooks/use-merchant';
import { createClient } from '@/lib/supabase/server';

const defaultStaffAccess: StaffAccess = {
  isStaff: false,
  isOwner: false,
  role: null,
  permissions: {},
};

// Use React cache() to deduplicate this call within a single request
// This means layout.tsx and page.tsx will share the same result
export const getMerchantForUser = cache(async () => {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (!user || authError) {
    return { merchant: null, staffAccess: defaultStaffAccess, user: null };
  }

  try {
    let merchantData: MerchantData | null = null;
    let access: StaffAccess = { ...defaultStaffAccess };

    // First, try to find merchant where user is owner
    const { data: ownedMerchant, error: ownerError } = await supabase
      .from('merchants')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (ownedMerchant && !ownerError) {
      merchantData = ownedMerchant as MerchantData;
      access = {
        isStaff: false,
        isOwner: true,
        role: null,
        permissions: { full_access: { all: true } },
      };
    } else if (ownerError && ownerError.code === 'PGRST116') {
      // User is not a merchant owner, check if they're staff
      const { data: staffMember, error: staffError } = await supabase
        .from('staff_members')
        .select(`
          id,
          role,
          permissions,
          status,
          merchant_id,
          merchants (*)
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      if (staffMember && !staffError) {
        // Correctly handle the join which might return an array or single object
        const merchantInfo = (Array.isArray(staffMember.merchants)
          ? staffMember.merchants[0]
          : staffMember.merchants) as unknown as MerchantData;

        if (merchantInfo) {
          // Get effective permissions (role defaults + custom overrides)
          const { data: rolePerms } = await supabase
            .from('role_permissions')
            .select('permissions')
            .eq('role', staffMember.role)
            .single();

          const defaultPerms = (rolePerms?.permissions || {}) as Record<
            string,
            Record<string, boolean>
          >;
          const customPerms = (staffMember.permissions || {}) as Record<
            string,
            Record<string, boolean>
          >;

          // Merge permissions: custom overrides defaults
          const mergedPermissions: Record<string, Record<string, boolean>> = {
            ...defaultPerms,
          };
          for (const [resource, actions] of Object.entries(customPerms)) {
            mergedPermissions[resource] = {
              ...mergedPermissions[resource],
              ...actions,
            };
          }

          merchantData = merchantInfo;
          access = {
            isStaff: true,
            isOwner: false,
            role: staffMember.role as StaffRole,
            permissions: mergedPermissions,
          };
        }
      }
    }

    // If we found a merchant, fetch their primary domain
    if (merchantData) {
      const { data: primaryDomain, error: domainError } = await supabase
        .from('domains')
        .select('domain')
        .eq('merchant_id', merchantData.id)
        .eq('is_primary', true)
        .eq('status', 'active')
        .single();

      // PGRST116 = no rows found, which is expected if merchant has no custom domain
      if (domainError && domainError.code !== 'PGRST116') {
        console.error('Error fetching primary domain:', domainError);
      }

      if (primaryDomain) {
        merchantData.custom_domain = primaryDomain.domain;
      }
    }

    return { merchant: merchantData, staffAccess: access, user };
  } catch (error) {
    console.error('Failed to load merchant data server-side:', error);
    return { merchant: null, staffAccess: defaultStaffAccess, user };
  }
});

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
