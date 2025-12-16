'use client';

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuthSafe } from '@/contexts/auth-context';
import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/client';

// Supabase data structure
export interface MerchantData {
  id: string;
  user_id: string;
  business_name: string;
  business_type: string;
  email?: string;
  phone?: string;
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
  google_product_sheet_url?: string;
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
  // Template selection
  template_id?: string;
  // Plan and Subscription
  plan_tier?: 'free' | 'starter' | 'pro' | 'business' | 'enterprise';
  premium_features?: string[]; // stored as JSONB array of feature keys
  plan_started_at?: string;
  plan_expires_at?: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  // Ad tracking settings
  offline_conversions_enabled?: boolean;
  // Analytics & Tracking Pixels
  facebook_pixel_id?: string;
  facebook_capi_token?: string;
  google_analytics_id?: string;
  ga4_api_secret?: string;
  tiktok_pixel_id?: string;
  tiktok_access_token?: string;
  snapchat_pixel_id?: string;
  snapchat_capi_token?: string;
  twitter_pixel_id?: string;
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
  updateMerchant: (
    data: Partial<MerchantData>,
    options?: { skipReload?: boolean }
  ) => Promise<void>;
  reloadMerchant: () => void;
  staffAccess: StaffAccess;
  hasPermission: (resource: string, action: string) => boolean;
  routingMode: 'domain' | 'path';
  basePath: string;
}

const MerchantContext = createContext<MerchantContextType | undefined>(
  undefined
);

interface MerchantProviderProps {
  children: ReactNode;
  slug?: string; // Optional slug for storefronts
  initialMerchant?: MerchantData | null;
  initialStaffAccess?: StaffAccess;
  initialRoutingMode?: 'domain' | 'path';
}

const defaultStaffAccess: StaffAccess = {
  isStaff: false,
  isOwner: false,
  role: null,
  permissions: {},
};

export const MerchantProvider = ({
  children,
  slug,
  initialMerchant,
  initialStaffAccess,
  initialRoutingMode,
}: MerchantProviderProps) => {
  // Use safe auth hook - returns null when outside AuthProvider (e.g., template preview)
  const auth = useAuthSafe();
  const user = auth?.user ?? null;
  const authLoading = auth?.loading ?? false;

  // Initialize state with props if available
  const [merchant, setMerchant] = useState<MerchantData | null>(
    initialMerchant ?? null
  );
  // If we have initial data, we're not loading unless fetching explicitly
  const [loading, setLoading] = useState(!initialMerchant);
  const [staffAccess, setStaffAccess] = useState<StaffAccess>(
    initialStaffAccess ?? defaultStaffAccess
  );

  // Routing context
  const routingMode = initialRoutingMode ?? 'path'; // Default to path to be explicit, but check usage
  const basePath =
    routingMode === 'domain' ? '' : `/${merchant?.slug || slug || ''}`;

  const supabase = useMemo(() => createClient(), []);
  // Initialize ref with prop value to avoid race condition
  const hasHydrated = useRef(!!initialMerchant);

  const loadData = useCallback(async () => {
    // If we provided initial data, skip the first automatic fetch
    if (!hasHydrated.current && initialMerchant && !slug) {
      hasHydrated.current = true;
      return;
    }

    // For storefront mode (slug provided), load immediately
    // For dashboard mode (no slug), wait for auth to finish loading
    if (!slug && authLoading) {
      return;
    }

    setLoading(true);

    try {
      let merchantData: MerchantData | null = null;
      let access: StaffAccess = { ...defaultStaffAccess };

      if (slug) {
        // If we provided initial mock data that matches this slug, use it and don't fetch
        if (initialMerchant && initialMerchant.slug === slug) {
          setMerchant(initialMerchant);
          setLoading(false);
          return;
        }

        // Mock data for Ogabassey demo
        if (slug === 'gadget-default-template') {
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
            plan_tier: 'pro',
          };
          setMerchant(merchantData);
          setLoading(false);
          return;
        }

        // Mock data for Ogabassey V2 template demo
        if (slug === 'ogabassey') {
          merchantData = {
            id: 'demo-ogabassey',
            user_id: 'demo-user',
            business_name: 'Ogabassey',
            business_type: 'GADGETS',
            logo_url:
              'https://ogabassey.com/wp-content/uploads/2023/06/Ogabassey-Logo-1.png',
            brand_colors: {
              primary: '#DC2626',
              background: '#0F172A',
              accent: '#22D3EE',
            },
            country: 'NG',
            slug: slug,
            published_config: null,
            plan_tier: 'pro',
          };
          setMerchant(merchantData);
          setLoading(false);
          return;
        }

        // Mock data for Premium Default template demo
        if (slug === 'premium-default') {
          merchantData = {
            id: 'demo-premium',
            user_id: 'demo-user',
            business_name: 'Premium Store',
            business_type: 'FASHION',
            logo_url: undefined,
            brand_colors: {
              primary: '#000000',
              background: '#FAFAFA',
              accent: '#D4AF37',
            },
            country: 'NG',
            slug: slug,
            published_config: null,
            plan_tier: 'pro',
          };
          setMerchant(merchantData);
          setLoading(false);
          return;
        }

        // Mock data for New Template demo
        if (slug === 'new-template-demo') {
          merchantData = {
            id: 'demo-new-template',
            user_id: 'demo-user',
            business_name: 'Modern Gadgets',
            business_type: 'GADGETS',
            logo_url: undefined,
            brand_colors: {
              primary: '#DC2626',
              background: '#FFFFFF',
              accent: '#111827',
            },
            country: 'NG',
            slug: slug,
            published_config: null,
            plan_tier: 'pro',
          };
          setMerchant(merchantData);
          setLoading(false);
          return;
        }

        // Mock data for Gadget Universe demo
        if (slug === 'gadget-universe-demo') {
          merchantData = {
            id: 'demo-gadget-universe',
            user_id: 'demo-user',
            business_name: 'Gadget Universe',
            business_type: 'GADGETS',
            logo_url: undefined, // Use text logo or default
            brand_colors: {
              primary: '#DC2626',
              background: '#FFFFFF',
              accent: '#111827',
            },
            country: 'NG',
            slug: slug,
            published_config: null,
            plan_tier: 'pro',
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

        // PERFORMANCE: Fetch owner and staff data in parallel instead of sequentially
        const [ownerResult, staffResult] = await Promise.all([
          supabase
            .from('merchants')
            .select('*')
            .eq('user_id', user.id)
            .single(),
          supabase
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
            .single(),
        ]);

        const { data: ownedMerchant, error: ownerError } = ownerResult;
        const { data: staffMember, error: staffError } = staffResult;

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

      // Fetch primary domain and attach it to merchantData
      // Note: This must be sequential since we need merchantData.id first
      if (merchantData?.id) {
        const { data: primaryDomain } = await supabase
          .from('domains')
          .select('domain')
          .eq('merchant_id', merchantData.id)
          .eq('is_primary', true)
          .eq('status', 'active')
          .single();

        if (primaryDomain) {
          merchantData.custom_domain = primaryDomain.domain;
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
  }, [slug, authLoading, user, initialMerchant, supabase.from]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const reloadMerchant = useCallback(() => {
    loadData();
  }, [loadData]);

  const updateMerchant = useCallback(
    async (data: Partial<MerchantData>, options?: { skipReload?: boolean }) => {
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

      // Optimistic update: merge new data into current state
      if (options?.skipReload) {
        setMerchant((prev) => (prev ? { ...prev, ...data } : prev));
        logger.info({ message: 'Merchant data updated optimistically.' });
      } else {
        logger.info({ message: 'Merchant data updated, reloading.' });
        reloadMerchant();
      }
    },
    [user, reloadMerchant, staffAccess, merchant?.id, supabase]
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
    routingMode,
    basePath,
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
