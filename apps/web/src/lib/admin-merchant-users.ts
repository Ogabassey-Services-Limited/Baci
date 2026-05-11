import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildCustomerRecord,
  buildOwnerRecord,
  buildStaffRecord,
  buildUnmatchedAppUsers,
} from '@/lib/admin-merchant-users.builders';
import {
  isAdminMerchantCustomerRow,
  isAdminMerchantPushTokenRow,
  isAdminMerchantRow,
  isAdminMerchantStaffRow,
  isValidRowArray,
} from '@/lib/admin-merchant-users.guards';
import type { AdminMerchantUsersDirectoryResult } from '@/lib/admin-merchant-users.types';
import { adminMerchantRouteParamsSchema } from '@/schemas/admin-merchant-route-params';

const MERCHANT_COLUMNS =
  'id, user_id, business_name, email, phone, slug, signup_source, plan_tier, is_published, created_at, updated_at';
const STAFF_COLUMNS =
  'id, user_id, email, name, role, status, last_login_at, created_at';
const CUSTOMER_COLUMNS =
  'id, user_id, email, first_name, last_name, full_name, auth_provider, deleted_at, last_login_at, created_at';
const PUSH_TOKEN_COLUMNS =
  'id, user_id, platform, is_active, app_type, created_at, updated_at, last_used_at';
const OWNER_WEB_USER_COUNT = 1;
const MAX_STAFF_MEMBERS = 200;
const MAX_CUSTOMERS = 100;
const MAX_PUSH_TOKENS = 500;

export async function getAdminMerchantUserDirectory(
  supabase: SupabaseClient,
  merchantId: string
): Promise<AdminMerchantUsersDirectoryResult> {
  const parseResult = adminMerchantRouteParamsSchema.safeParse({ merchantId });
  if (!parseResult.success) {
    return {
      data: null,
      error: { code: 'INVALID_MERCHANT_ID', message: 'Invalid merchant ID' },
    };
  }

  const validatedMerchantId = parseResult.data.merchantId;
  const merchantResult = await supabase
    .from('merchants')
    .select(MERCHANT_COLUMNS)
    .eq('id', validatedMerchantId)
    .maybeSingle();

  if (merchantResult.error) {
    return { data: null, error: merchantResult.error };
  }

  if (merchantResult.data && !isAdminMerchantRow(merchantResult.data)) {
    return {
      data: null,
      error: {
        code: 'INVALID_ROW_SHAPE',
        message: 'Invalid merchant row returned from database',
      },
    };
  }

  const merchant = merchantResult.data;
  if (!merchant) {
    return { data: null, error: null };
  }

  const [staffResult, customersResult, pushTokensResult] = await Promise.all([
    supabase
      .from('staff_members')
      .select(STAFF_COLUMNS)
      .eq('merchant_id', validatedMerchantId)
      .order('created_at', { ascending: false })
      .limit(MAX_STAFF_MEMBERS),
    supabase
      .from('customers')
      .select(CUSTOMER_COLUMNS)
      .eq('merchant_id', validatedMerchantId)
      .order('last_login_at', { ascending: false, nullsFirst: false })
      .limit(MAX_CUSTOMERS),
    supabase
      .from('push_tokens')
      .select(PUSH_TOKEN_COLUMNS)
      .eq('merchant_id', validatedMerchantId)
      .order('updated_at', { ascending: false })
      .limit(MAX_PUSH_TOKENS),
  ]);

  const firstError =
    staffResult.error ?? customersResult.error ?? pushTokensResult.error;
  if (firstError) {
    return { data: null, error: firstError };
  }

  const rawPushTokens = pushTokensResult.data ?? [];
  const rawStaff = staffResult.data ?? [];
  const rawCustomers = customersResult.data ?? [];

  if (
    !isValidRowArray(rawPushTokens, isAdminMerchantPushTokenRow) ||
    !isValidRowArray(rawStaff, isAdminMerchantStaffRow) ||
    !isValidRowArray(rawCustomers, isAdminMerchantCustomerRow)
  ) {
    return {
      data: null,
      error: {
        code: 'INVALID_ROW_SHAPE',
        message: 'Invalid merchant user row returned from database',
      },
    };
  }

  const pushTokens = rawPushTokens;
  const staff = rawStaff.map((row) => buildStaffRecord(row, pushTokens));
  const customers = rawCustomers.map((row) =>
    buildCustomerRecord(row, pushTokens)
  );
  const owner = buildOwnerRecord(merchant, pushTokens);

  const knownUserIds = new Set(
    [owner, ...staff, ...customers]
      .map((user) => user.userId)
      .filter((userId): userId is string => Boolean(userId))
  );
  const unmatchedAppUsers = buildUnmatchedAppUsers(pushTokens, knownUserIds);
  const activeAdminPushTokens = pushTokens.filter(
    (token) => token.is_active && token.app_type === 'admin'
  );
  const activeStorefrontPushTokens = pushTokens.filter(
    (token) => token.is_active && token.app_type === 'storefront'
  );

  return {
    data: {
      generatedAt: new Date().toISOString(),
      merchant: {
        businessName: merchant.business_name,
        createdAt: merchant.created_at,
        email: merchant.email,
        id: merchant.id,
        isPublished: merchant.is_published,
        phone: merchant.phone,
        planTier: merchant.plan_tier,
        signupSource: merchant.signup_source,
        slug: merchant.slug,
        updatedAt: merchant.updated_at,
      },
      summary: {
        activeAdminAppInstallations: activeAdminPushTokens.length,
        activeStorefrontAppInstallations: activeStorefrontPushTokens.length,
        customerUsers: customers.length,
        staffUsers: staff.length,
        unmatchedAppUsers: unmatchedAppUsers.length,
        webUsers: OWNER_WEB_USER_COUNT + staff.length + customers.length,
      },
      users: {
        customers,
        owner,
        staff,
        unmatchedAppUsers,
      },
    },
    error: null,
  };
}
