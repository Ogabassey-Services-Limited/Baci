import 'server-only';

import { logger } from '@/lib/logger';

interface CreditDirectConfirmationReviewClient {
  from(relation: 'reconciliation_review'): {
    update(values: { resolution_notes: string; resolved_at: string }): {
      eq(
        column: 'issue_type',
        value: 'credit_direct_confirmation_missing'
      ): {
        eq(
          column: 'order_id',
          value: string
        ): {
          is(
            column: 'resolved_at',
            value: null
          ): PromiseLike<{ error: unknown }>;
        };
      };
    };
  };
}

export async function resolveCreditDirectConfirmationReview({
  orderId,
  providerReference,
  supabase,
}: {
  orderId: string;
  providerReference: string;
  supabase: CreditDirectConfirmationReviewClient;
}): Promise<boolean> {
  const resolvedAt = new Date().toISOString();

  try {
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
