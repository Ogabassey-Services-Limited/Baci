import type {
  AdminMerchantCustomerRow,
  AdminMerchantPushTokenRow,
  AdminMerchantRow,
  AdminMerchantStaffRow,
} from '@/lib/admin-merchant-users.types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === 'string' || value === null;
}

function isNullableBoolean(value: unknown): value is boolean | null {
  return typeof value === 'boolean' || value === null;
}

export function isAdminMerchantRow(value: unknown): value is AdminMerchantRow {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    isNullableString(value.user_id) &&
    isNullableString(value.business_name) &&
    isNullableString(value.email) &&
    isNullableString(value.phone) &&
    isNullableString(value.slug) &&
    isNullableString(value.signup_source) &&
    isNullableString(value.plan_tier) &&
    isNullableBoolean(value.is_published) &&
    isNullableString(value.created_at) &&
    isNullableString(value.updated_at)
  );
}

export function isAdminMerchantStaffRow(
  value: unknown
): value is AdminMerchantStaffRow {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    isNullableString(value.user_id) &&
    isNullableString(value.email) &&
    isNullableString(value.name) &&
    isNullableString(value.role) &&
    isNullableString(value.status) &&
    isNullableString(value.last_login_at) &&
    isNullableString(value.created_at)
  );
}

export function isAdminMerchantCustomerRow(
  value: unknown
): value is AdminMerchantCustomerRow {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    isNullableString(value.user_id) &&
    isNullableString(value.email) &&
    isNullableString(value.first_name) &&
    isNullableString(value.last_name) &&
    isNullableString(value.full_name) &&
    isNullableString(value.auth_provider) &&
    isNullableString(value.deleted_at) &&
    isNullableString(value.last_login_at) &&
    isNullableString(value.created_at)
  );
}

export function isAdminMerchantPushTokenRow(
  value: unknown
): value is AdminMerchantPushTokenRow {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    isNullableString(value.user_id) &&
    isNullableString(value.platform) &&
    isNullableBoolean(value.is_active) &&
    isNullableString(value.app_type) &&
    isNullableString(value.created_at) &&
    isNullableString(value.updated_at) &&
    isNullableString(value.last_used_at)
  );
}

export function isValidRowArray<T>(
  value: unknown,
  guard: (row: unknown) => row is T
): value is T[] {
  return Array.isArray(value) && value.every(guard);
}
