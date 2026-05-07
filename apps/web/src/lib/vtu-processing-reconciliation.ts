import type { SupabaseClient } from '@supabase/supabase-js';
import { fulfillPendingVtuTransaction } from '@/lib/vtu-fulfillment';

const RECONCILABLE_VTU_TYPES = ['electricity', 'cable_tv', 'betting'] as const;
const DEFAULT_RECONCILIATION_LIMIT = 25;
const MAX_RECONCILIATION_LIMIT = 50;
const MIN_PROCESSING_AGE_MS = 45_000;
const MAX_PROCESSING_AGE_MS = 24 * 60 * 60 * 1000;

interface ProcessingVtuCandidate {
  id: string;
}

export interface VtuProcessingReconciliationSummary {
  checked: number;
  errored: number;
  errors: Array<{
    message: string;
    transactionId: string;
  }>;
  failed: number;
  processing: number;
  successful: number;
}

function normalizeLimit(limit: number | undefined) {
  if (!Number.isSafeInteger(limit) || !limit || limit < 1) {
    return DEFAULT_RECONCILIATION_LIMIT;
  }

  return Math.min(limit, MAX_RECONCILIATION_LIMIT);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function reconcileProcessingVtuTransactions({
  limit,
  now = new Date(),
  supabase,
}: {
  limit?: number;
  now?: Date;
  supabase: SupabaseClient;
}): Promise<VtuProcessingReconciliationSummary> {
  const olderThan = new Date(now.getTime() - MIN_PROCESSING_AGE_MS);
  const newerThan = new Date(now.getTime() - MAX_PROCESSING_AGE_MS);
  const { data, error } = await supabase
    .from('vtu_transactions')
    .select(
      'id, request_reference, transaction_id, type, created_at, updated_at'
    )
    .eq('status', 'processing')
    .in('type', [...RECONCILABLE_VTU_TYPES])
    .lte('created_at', olderThan.toISOString())
    .gte('created_at', newerThan.toISOString())
    .order('created_at', { ascending: true })
    .limit(normalizeLimit(limit));

  if (error) {
    throw new Error(
      `Failed to fetch processing VTU transactions: ${error.message}`
    );
  }

  const candidates = (data ?? []) as ProcessingVtuCandidate[];
  const summary: VtuProcessingReconciliationSummary = {
    checked: candidates.length,
    errored: 0,
    errors: [],
    failed: 0,
    processing: 0,
    successful: 0,
  };

  for (const candidate of candidates) {
    try {
      const result = await fulfillPendingVtuTransaction({
        supabase,
        transactionId: candidate.id,
      });
      if (result.status === 'successful') {
        summary.successful += 1;
      } else if (result.status === 'failed') {
        summary.failed += 1;
      } else {
        summary.processing += 1;
      }
    } catch (error) {
      summary.errored += 1;
      summary.errors.push({
        message: getErrorMessage(error),
        transactionId: candidate.id,
      });
    }
  }

  return summary;
}
