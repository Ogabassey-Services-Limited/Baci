import type { SupabaseClient } from '@supabase/supabase-js';

export async function deleteReceiptClaim({
  supabase,
  claimId,
}: {
  supabase: SupabaseClient;
  claimId: string;
}) {
  const { error } = await supabase
    .from('receipt_claims')
    .delete()
    .eq('id', claimId);

  if (error) {
    throw new Error(`Failed to delete unsent receipt claim: ${error.message}`);
  }
}

export async function markReceiptClaimNotificationSent({
  supabase,
  claimId,
}: {
  supabase: SupabaseClient;
  claimId: string;
}) {
  const { error } = await supabase
    .from('receipt_claims')
    .update({ notification_sent_at: new Date().toISOString() })
    .eq('id', claimId);

  if (error) {
    throw new Error(
      `Failed to mark receipt claim notification sent: ${error.message}`
    );
  }
}
