import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { ambiguousReviewSchema } from '@/schemas/order-wallet-funding-intent';

export async function fileAmbiguousReview({
  gatewayReference,
  intentIds,
  supabase,
}: {
  gatewayReference: string;
  intentIds: string[];
  supabase: SupabaseClient;
}) {
  const validated = ambiguousReviewSchema.parse({
    gatewayReference,
    intentIds,
  });

  const { error } = await supabase.rpc(
    'file_wallet_order_funding_ambiguous_review',
    {
      p_gateway_reference: validated.gatewayReference,
      p_intent_ids: validated.intentIds,
    }
  );
  if (!error) {
    return;
  }

  logger.error({
    error,
    gatewayReference: validated.gatewayReference,
    intentIds: validated.intentIds,
    message: 'Failed to file wallet-funded order ambiguity review',
  });
  throw error;
}
