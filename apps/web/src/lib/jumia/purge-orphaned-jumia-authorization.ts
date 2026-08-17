import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

export async function purgeOrphanedJumiaAuthorization(
  supabase: SupabaseClient,
  merchantId: string,
  integrationId: string
): Promise<void> {
  const { error } = await supabase.rpc('purge_orphaned_jumia_authorization', {
    p_merchant_id: merchantId,
    p_integration_id: integrationId,
  });
  if (error) {
    logger.error({
      message: 'Failed to purge orphaned Jumia authorization',
      error,
    });
  }
}
