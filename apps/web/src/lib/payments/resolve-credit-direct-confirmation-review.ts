import 'server-only';

import { logger } from '@/lib/logger';
import { createAdminClient } from '@/lib/supabase/admin';

export async function resolveCreditDirectConfirmationReview({
  orderId,
  providerReference,
}: {
  orderId: string;
  providerReference: string;
}): Promise<boolean> {
  const resolvedAt = new Date().toISOString();

  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from('reconciliation_review')
      .update({
        resolution_notes: `Signed Credit Direct merchant-payment webhook received for ${providerReference}.`,
        resolved_at: resolvedAt,
      })
      .eq('issue_type', 'credit_direct_confirmation_missing')
      .eq('order_id', orderId)
      .is('resolved_at', null);

    if (!error) {
      return true;
    }

    logger.error({
      message: 'Failed to resolve Credit Direct confirmation review',
      error,
      orderId,
      providerReference,
    });
  } catch (error) {
    logger.error({
      message: 'Failed to resolve Credit Direct confirmation review',
      error,
      orderId,
      providerReference,
    });
  }

  return false;
}
