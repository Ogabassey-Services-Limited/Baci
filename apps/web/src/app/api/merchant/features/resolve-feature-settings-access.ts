import type { SupabaseClient } from '@supabase/supabase-js';
import { hasPermission, type UserAccess } from '@/lib/api-auth';
import { resolveSelectedMerchantAccess } from './resolve-selected-merchant-access';

type FeatureSettingsPermission = 'edit' | 'read';

type FeatureSettingsAccessError =
  | { message: 'Invalid merchant ID'; status: 400 }
  | { message: 'Permission denied'; status: 403 }
  | { message: 'Merchant not found'; status: 404 };

type ResolveFeatureSettingsAccessInput = {
  permission: FeatureSettingsPermission;
  requestedMerchantId: unknown;
  supabase: SupabaseClient;
  userId: string;
};

function hasRequiredPermission(
  access: UserAccess,
  permission: FeatureSettingsPermission
) {
  if (permission === 'edit') {
    return hasPermission(access, 'settings', 'edit');
  }

  return (
    hasPermission(access, 'settings', 'view') ||
    hasPermission(access, 'marketing', 'view') ||
    hasPermission(access, 'dashboard', 'view')
  );
}

/**
 * Resolves a requested merchant and enforces the feature-settings permission
 * before any settings read or write is attempted.
 */
export async function resolveFeatureSettingsAccess({
  permission,
  requestedMerchantId,
  supabase,
  userId,
}: ResolveFeatureSettingsAccessInput): Promise<{
  access: UserAccess | null;
  error: FeatureSettingsAccessError | null;
}> {
  const { access, invalidMerchantId } = await resolveSelectedMerchantAccess({
    requestedMerchantId,
    supabase,
    userId,
  });
  if (invalidMerchantId) {
    return {
      access: null,
      error: { message: 'Invalid merchant ID', status: 400 },
    };
  }
  if (!access) {
    return {
      access: null,
      error: { message: 'Merchant not found', status: 404 },
    };
  }
  if (!hasRequiredPermission(access, permission)) {
    return {
      access: null,
      error: { message: 'Permission denied', status: 403 },
    };
  }

  return { access, error: null };
}
