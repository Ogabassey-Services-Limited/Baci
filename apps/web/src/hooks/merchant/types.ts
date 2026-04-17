import type { ReactNode } from 'react';
import type { CategoryNavItem } from '@/lib/cached-categories';
import type { HeroSlide } from '@/lib/cached-data';

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
  paystack_subaccount_code?: string | null;
  published_config?: Record<string, unknown> | null;
  // Favicon
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
    snapchat?: string;
  };
  // Contact
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
    shipping_insurance_enabled?: boolean;
    low_stock_threshold?: number;
    [key: string]: unknown;
  };
  // Template
  template_id?: string;
  // Plan and Subscription
  plan_tier?: 'free' | 'starter' | 'pro' | 'business' | 'enterprise';
  premium_features?: string[];
  plan_started_at?: string;
  plan_expires_at?: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  // Ad tracking
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
  virtual_terminal_code?: string;
  // VAT
  vat_registration_status?:
    | 'not_registered'
    | 'registered'
    | 'exempt'
    | 'pending';
  vat_rate?: number;
  // KYC
  nin?: string;
  bvn?: string;
  cac_rc_number?: string;
  kyc_status?: 'pending' | 'verified' | 'rejected' | null;
  // Hero slides
  hero_slides?: HeroSlide[];
  mobile_hero_slides?: HeroSlide[];
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

export interface MerchantContextType {
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
  navigationCategories: CategoryNavItem[];
}

export interface MerchantProviderProps {
  children: ReactNode;
  slug?: string;
  initialMerchant?: MerchantData | null;
  initialStaffAccess?: StaffAccess;
  initialRoutingMode?: 'domain' | 'path';
  navigationCategories?: CategoryNavItem[];
}
