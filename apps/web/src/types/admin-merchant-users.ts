export type AdminMerchantUserRole = 'owner' | 'staff' | 'customer' | 'app_user';

export type AdminMerchantSurface = 'web' | 'admin_app' | 'storefront_app';

export interface AdminMerchantIdentity {
  id: string;
  /** @sensitive merchant business identity shown only in platform-admin views */
  businessName: string | null;
  /** @sensitive owner contact shown only in platform-admin views */
  email: string | null;
  /** @sensitive owner phone shown only in platform-admin views */
  phone: string | null;
  slug: string | null;
  signupSource: string | null;
  planTier: string | null;
  isPublished: boolean | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AdminMerchantUserRecord {
  id: string;
  userId: string | null;
  /** @sensitive user contact shown only in platform-admin views */
  email: string | null;
  name: string | null;
  role: AdminMerchantUserRole;
  staffRole: string | null;
  status: string;
  surfaces: AdminMerchantSurface[];
  appPlatforms: string[];
  activeAppInstallations: number;
  lastSeenAt: string | null;
  createdAt: string | null;
}

export type PublicAdminMerchantIdentity = Omit<
  AdminMerchantIdentity,
  'businessName' | 'email' | 'phone'
>;

export type PublicAdminMerchantUserRecord = Omit<
  AdminMerchantUserRecord,
  'email' | 'name'
>;

export interface AdminMerchantUsersSummary {
  webUsers: number;
  staffUsers: number;
  customerUsers: number;
  activeAdminAppInstallations: number;
  activeStorefrontAppInstallations: number;
  unmatchedAppUsers: number;
}

export interface AdminMerchantUsersResponse {
  merchant: AdminMerchantIdentity;
  summary: AdminMerchantUsersSummary;
  users: {
    owner: AdminMerchantUserRecord;
    staff: AdminMerchantUserRecord[];
    customers: AdminMerchantUserRecord[];
    unmatchedAppUsers: AdminMerchantUserRecord[];
  };
  /** ISO 8601 UTC timestamp for when the directory snapshot was generated. */
  generatedAt: string;
}
