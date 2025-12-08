import { cache } from 'react';
import { cookies } from 'next/headers';
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
        // User is an active staff member
        const merchantInfo = staffMember.merchants as unknown as MerchantData;
        merchantData = merchantInfo;

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

        access = {
          isStaff: true,
          isOwner: false,
          role: staffMember.role as StaffRole,
          permissions: mergedPermissions,
        };
      }
    }

    return { merchant: merchantData, staffAccess: access, user };
  } catch (error) {
    console.error('Failed to load merchant data server-side:', error);
    return { merchant: null, staffAccess: defaultStaffAccess, user };
  }
});
