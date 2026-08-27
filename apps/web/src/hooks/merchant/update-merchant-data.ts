import { apiPost } from '@/lib/api-client';
import { logger } from '@/lib/logger';
import { permissionGrantsAccess } from '@/lib/permission-grant';
import type { createClient } from '@/lib/supabase/client';
import {
  assertNoIdentityFields,
  pickGenericWritable,
} from './merchant-writable-fields';
import type { MerchantData, StaffAccess } from './types';

type SupabaseClient = ReturnType<typeof createClient>;
type SetMerchant = (
  merchant:
    | MerchantData
    | null
    | ((current: MerchantData | null) => MerchantData | null)
) => void;

interface MerchantUpdateOptions {
  merchantId?: string;
  skipReload?: boolean;
}

interface CreateMerchantUpdateArgs {
  supabase: SupabaseClient;
  userId: string | null;
  staffAccess: StaffAccess;
  activeMerchantId: string | null | undefined;
  setMerchant: SetMerchant;
  reloadMerchant: () => void;
}

const BLOG_CARD_BRANDING_FIELDS = new Set<string>([
  'brand_colors',
  'business_name',
  'logo_url',
] satisfies readonly (keyof MerchantData)[]);

async function revalidateBrandDependentBlogCards(
  data: Partial<MerchantData>,
  merchantId: string
) {
  if (!Object.keys(data).some((key) => BLOG_CARD_BRANDING_FIELDS.has(key))) {
    return;
  }

  try {
    await apiPost('/api/cache/revalidate', {
      merchantId,
      targets: ['merchant', 'blog'],
    });
  } catch (error) {
    // The authoritative merchant write already succeeded. Keep cache eviction
    // fail-open, matching the existing revalidation boundary: stale cards
    // self-heal, while retrying the settings save must not duplicate the write.
    logger.warn({
      message: 'Merchant branding saved but blog card revalidation failed.',
      error: error instanceof Error ? error : new Error(String(error)),
    });
  }
}

export function createMerchantUpdate({
  supabase,
  userId,
  staffAccess,
  activeMerchantId,
  setMerchant,
  reloadMerchant,
}: CreateMerchantUpdateArgs) {
  return async (
    data: Partial<MerchantData>,
    options?: MerchantUpdateOptions
  ): Promise<void> => {
    if (!userId) {
      const errorMsg = 'Cannot update merchant data, no user logged in.';
      logger.error({ message: errorMsg });
      throw new Error(errorMsg);
    }

    if (
      staffAccess.isStaff &&
      !permissionGrantsAccess(staffAccess.permissions, 'settings', 'edit')
    ) {
      const errorMsg = "You don't have permission to update store settings.";
      logger.error({ message: errorMsg });
      throw new Error(errorMsg);
    }

    assertNoIdentityFields(data);

    const writableData = pickGenericWritable(data);
    if (Object.keys(writableData).length === 0) {
      logger.info({
        message: 'Merchant update skipped: no generic-writable fields present.',
      });
      return;
    }

    const merchantId = options?.merchantId ?? activeMerchantId;
    if (!merchantId) {
      throw new Error(
        'Cannot update merchant data without a selected merchant.'
      );
    }

    logger.info({
      message: 'Updating merchant data in Supabase...',
      data: writableData,
    });

    const query = staffAccess.isOwner
      ? supabase
          .from('merchants')
          .update(writableData)
          .eq('id', merchantId)
          .eq('user_id', userId)
      : supabase.from('merchants').update(writableData).eq('id', merchantId);

    const { error } = await query;
    if (error) {
      logger.error({
        message: 'Failed to update merchant data',
        error: error as Error,
      });
      throw error;
    }

    void revalidateBrandDependentBlogCards(writableData, merchantId);

    const hasExplicitMerchantTarget = options?.merchantId !== undefined;
    if (options?.skipReload || hasExplicitMerchantTarget) {
      setMerchant((current) =>
        current?.id === merchantId ? { ...current, ...writableData } : current
      );
      logger.info({
        message: hasExplicitMerchantTarget
          ? 'Selected merchant data updated in its matching context.'
          : 'Merchant data updated optimistically.',
      });
      return;
    }

    logger.info({ message: 'Merchant data updated, reloading.' });
    reloadMerchant();
  };
}
