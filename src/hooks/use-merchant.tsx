'use client';

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useAuth } from '@/contexts/auth-context';
import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/client';

// Supabase data structure
export interface MerchantData {
  id: string;
  user_id: string;
  business_name: string;
  business_type: string;
  logo_url?: string;
  brand_colors?: {
    primary: string;
    background: string;
    accent: string;
  };
  country?: string;
  pages?: {
    about?: string;
    contact?: string;
    privacy?: string;
    terms?: string;
    faq?: string;
    legal?: string;
  };
  slug?: string;
  custom_domain?: string;
  published_config?: Record<string, unknown> | null;
  // Favicon properties
  favicon_svg_url?: string;
  favicon_png_32_url?: string;
  favicon_png_192_url?: string;
  favicon_apple_touch_url?: string;
  favicon_uploaded_at?: string;
  // Social media
  social_media?: {
    twitter?: string;
    facebook?: string;
    instagram?: string;
    tiktok?: string;
    youtube?: string;
    pinterest?: string;
    linkedin?: string;
  };
  // Contact info for footer
  support_email?: string;
  support_phone?: string;
  business_address?: string;
  rider_phone_number?: string;
  // Store publish status
  is_published?: boolean;
  published_at?: string;
  // Feature settings
  feature_settings?: {
    pay_on_delivery_enabled?: boolean;
    // biome-ignore lint/suspicious/noExplicitAny: Feature settings are dynamic and can have any shape
    [key: string]: any;
  };
}

export type StaffRole =
  | 'admin'
  | 'manager'
  | 'sales_rep'
  | 'inventory'
  | 'accountant'
  | 'customer_service'
  | 'marketing'
  | 'fulfillment';

export interface StaffAccess {
  isStaff: boolean;
  isOwner: boolean;
  role: StaffRole | null;
  permissions: Record<string, Record<string, boolean>>;
}

interface MerchantContextType {
  merchant: MerchantData | null;
  loading: boolean;
  updateMerchant: (data: Partial<MerchantData>) => Promise<void>;
  reloadMerchant: () => void;
  staffAccess: StaffAccess;
  hasPermission: (resource: string, action: string) => boolean;
}

const MerchantContext = createContext<MerchantContextType | undefined>(
  undefined
);

interface MerchantProviderProps {
  children: ReactNode;
  slug?: string; // Optional slug for storefronts
}

const defaultStaffAccess: StaffAccess = {
  isStaff: false,
  isOwner: false,
  role: null,
  permissions: {},
};

export const MerchantProvider = ({ children, slug }: MerchantProviderProps) => {
  const { user, loading: authLoading } = useAuth();
  const [merchant, setMerchant] = useState<MerchantData | null>(null);
  const [loading, setLoading] = useState(true);
  const [staffAccess, setStaffAccess] =
    useState<StaffAccess>(defaultStaffAccess);
  const supabase = createClient();

  const loadData = useCallback(async () => {
    // For storefront mode (slug provided), load immediately
    // For dashboard mode (no slug), wait for auth to finish loading
    if (!slug && authLoading) {
      // Keep loading state as true - don't set to false until auth is ready
      // This prevents premature redirect to onboarding
      return;
    }

    setLoading(true);

    try {
      let merchantData: MerchantData | null = null;
      let access: StaffAccess = { ...defaultStaffAccess };

      if (slug) {
        // Mock data for Ogabassey demo
        if (
          slug === 'ogabassey1' ||
          slug === 'ogabassey3' ||
          slug === 'gadget-custom-template-ogabassey' ||
          slug === 'gadget-default-template'
        ) {
          merchantData = {
            id: 'demo-ogabassey',
            user_id: 'demo-user',
            business_name: 'Ogabassey',
            business_type: 'FASHION',
            logo_url:
              'https://ogabassey.com/wp-content/uploads/2023/06/Ogabassey-Logo-1.png',
            brand_colors: {
              primary: '#EF4444',
              background: '#FFFFFF',
              accent: '#000000',
            },
            country: 'NG',
            slug: slug,
            published_config: null,
          };
          setMerchant(merchantData);
          setLoading(false);
          return;
        }

        // Storefront mode - load by slug
        const { data, error } = await supabase
          .from('merchants')
          .select('*')
          .eq('slug', slug)
          .single();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }
        merchantData = data as MerchantData;
      } else {
        // Dashboard mode - check ownership first, then staff membership
        if (!user) {
          setMerchant(null);
          setStaffAccess(defaultStaffAccess);
          setLoading(false);
          return;
        }

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
            const merchantInfo =
              staffMember.merchants as unknown as MerchantData;
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
        } else if (ownerError) {
          throw ownerError;
        }
      }

      setMerchant(merchantData);
      setStaffAccess(access);
    } catch (error) {
      logger.error({
        message: `Failed to load merchant data. Slug: ${slug}, Error: ${(error as Error).message}`,
      });
      setMerchant(null);
      setStaffAccess(defaultStaffAccess);
    } finally {
      setLoading(false);
    }
  }, [slug, authLoading, user, supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const reloadMerchant = useCallback(() => {
    loadData();
  }, [loadData]);

  const updateMerchant = useCallback(
    async (data: Partial<MerchantData>) => {
      if (!user) {
        const errorMsg = 'Cannot update merchant data, no user logged in.';
        logger.error({ message: errorMsg });
        throw new Error(errorMsg);
      }

      // Check if user has permission to update merchant settings
      if (staffAccess.isStaff && !staffAccess.permissions.settings?.edit) {
        const errorMsg = "You don't have permission to update store settings.";
        logger.error({ message: errorMsg });
        throw new Error(errorMsg);
      }

      logger.info({ message: 'Updating merchant data in Supabase...', data });

      // For staff, update by merchant_id instead of user_id
      const query = staffAccess.isOwner
        ? supabase.from('merchants').update(data).eq('user_id', user.id)
        : supabase.from('merchants').update(data).eq('id', merchant?.id);

      const { error } = await query;

      if (error) {
        logger.error({
          message: 'Failed to update merchant data',
          error: error as Error,
        });
        throw error;
      }

      logger.info({ message: 'Merchant data updated, reloading.' });
      reloadMerchant();
    },
    [user, supabase, reloadMerchant, staffAccess, merchant?.id]
  );

  // Helper function to check permissions
  const hasPermission = useCallback(
    (resource: string, action: string): boolean => {
      // Owners have full access
      if (staffAccess.isOwner) return true;

      // Check staff permissions
      if (staffAccess.isStaff) {
        return staffAccess.permissions[resource]?.[action] === true;
      }

      return false;
    },
    [staffAccess]
  );

  const value = {
    merchant,
    loading,
    updateMerchant,
    reloadMerchant,
    staffAccess,
    hasPermission,
  };

  return (
    <MerchantContext.Provider value={value}>
      {children}
    </MerchantContext.Provider>
  );
};

export const useMerchant = (): MerchantContextType => {
  const context = useContext(MerchantContext);
  if (context === undefined) {
    throw new Error('useMerchant must be used within a MerchantProvider');
  }
  return context as MerchantContextType;
};

/**
 * Safe version of useMerchant that returns null instead of throwing
 * Use this in components that might render outside of MerchantProvider (e.g., previews)
 */
export const useMerchantSafe = (): MerchantContextType | null => {
  const context = useContext(MerchantContext);
  return context === undefined ? null : context;
};
