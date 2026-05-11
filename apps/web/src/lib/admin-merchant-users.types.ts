import type { AdminMerchantUsersResponse } from '@/types/admin-merchant-users';

export type AdminMerchantUsersQueryError = {
  code?: string;
  message?: string;
};

export type AdminMerchantUsersDirectoryResult = {
  data: AdminMerchantUsersResponse | null;
  error: AdminMerchantUsersQueryError | null;
};

export type AdminMerchantRow = {
  id: string;
  user_id: string | null;
  business_name: string | null;
  email: string | null;
  phone: string | null;
  slug: string | null;
  signup_source: string | null;
  plan_tier: string | null;
  is_published: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

export type AdminMerchantStaffRow = {
  id: string;
  user_id: string | null;
  email: string | null;
  name: string | null;
  role: string | null;
  status: string | null;
  last_login_at: string | null;
  created_at: string | null;
};

export type AdminMerchantCustomerRow = {
  id: string;
  user_id: string | null;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  auth_provider: string | null;
  deleted_at: string | null;
  last_login_at: string | null;
  created_at: string | null;
};

export type AdminMerchantPushTokenRow = {
  id: string;
  user_id: string | null;
  platform: string | null;
  is_active: boolean | null;
  app_type: string | null;
  created_at: string | null;
  updated_at: string | null;
  last_used_at: string | null;
};
