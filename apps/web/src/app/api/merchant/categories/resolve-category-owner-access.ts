import type { SupabaseClient } from '@supabase/supabase-js';

export type CategoryOwnerAccessResult =
  | {
      kind: 'owner';
      canonicalMerchantSlug: string | null;
      merchantId: string;
    }
  | { kind: 'staff' }
  | { kind: 'absent' }
  | { kind: 'lookup-failed' };

/**
 * Resolve the category route's owner-only permission without collapsing a
 * database failure into an absent merchant. The generic merchant resolver is
 * intentionally fail-soft for older callers; a write boundary must preserve
 * the difference so transient reads produce a retryable 500.
 */
export async function resolveCategoryOwnerAccess(
  supabase: SupabaseClient,
  userId: string,
  requestedMerchantId?: string
): Promise<CategoryOwnerAccessResult> {
  let ownerQuery = supabase
    .from('merchants')
    .select('id, slug')
    .eq('user_id', userId);

  ownerQuery = requestedMerchantId
    ? ownerQuery.eq('id', requestedMerchantId)
    : ownerQuery
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .limit(1);

  const owner = await ownerQuery.maybeSingle<{
    id: string;
    slug: string | null;
  }>();
  if (owner.error) return { kind: 'lookup-failed' };
  if (owner.data) {
    return {
      kind: 'owner',
      canonicalMerchantSlug: owner.data.slug?.trim() || null,
      merchantId: owner.data.id,
    };
  }

  let staffQuery = supabase
    .from('staff_members')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active');
  staffQuery = requestedMerchantId
    ? staffQuery.eq('merchant_id', requestedMerchantId).limit(1)
    : staffQuery.limit(1);

  const staff = await staffQuery.maybeSingle<{ id: string }>();
  if (staff.error) return { kind: 'lookup-failed' };
  return staff.data ? { kind: 'staff' } : { kind: 'absent' };
}
