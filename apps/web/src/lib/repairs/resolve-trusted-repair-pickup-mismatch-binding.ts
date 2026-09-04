import type { SupabaseClient } from '@supabase/supabase-js';

export type TrustedRepairPickupMismatchBinding =
  | {
      kind: 'bound';
      merchantId: string;
      repairId: string;
    }
  | { kind: 'orphan' }
  | { kind: 'lookup_failed' };

/**
 * Resolve merchant/repair for mismatch ledgering from a signed claim, or — when
 * the claim is missing/invalid — from the trusted pending Paystack reference
 * history (every retry tip is preserved). Never trusts unsigned metadata UUIDs.
 */
export async function resolveTrustedRepairPickupMismatchBinding(options: {
  claim: { merchantId: string; repairId: string } | null;
  reference: string;
  supabase: SupabaseClient;
}): Promise<TrustedRepairPickupMismatchBinding> {
  if (options.claim) {
    return {
      kind: 'bound',
      merchantId: options.claim.merchantId,
      repairId: options.claim.repairId,
    };
  }

  const { data, error } = await options.supabase
    .from('repair_pickup_pending_payment_references')
    .select('repair_id, merchant_id')
    .eq('reference', options.reference)
    .maybeSingle();

  if (error) {
    console.error(
      'Repair pickup pending-reference binding lookup failed:',
      error
    );
    return { kind: 'lookup_failed' };
  }

  if (
    !data ||
    typeof data !== 'object' ||
    typeof (data as { repair_id?: unknown }).repair_id !== 'string' ||
    typeof (data as { merchant_id?: unknown }).merchant_id !== 'string'
  ) {
    return { kind: 'orphan' };
  }

  return {
    kind: 'bound',
    merchantId: (data as { merchant_id: string }).merchant_id,
    repairId: (data as { repair_id: string }).repair_id,
  };
}
