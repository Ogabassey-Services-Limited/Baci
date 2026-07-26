import type { CategoryRouteContext } from './category-route-types';

export type ParentOwnershipResult =
  | 'owned'
  | 'absent'
  | 'retired'
  | 'lookup-failed';

/** Verify that an active proposed parent belongs to the same merchant. */
export async function isParentCategoryOwnedByMerchant(
  supabase: CategoryRouteContext['supabase'],
  merchantId: string,
  parentId: string
): Promise<ParentOwnershipResult> {
  const { data, error } = await supabase
    .from('categories')
    .select('id, is_active')
    .eq('id', parentId)
    .eq('merchant_id', merchantId)
    .maybeSingle<{ id: string; is_active: boolean | null }>();

  if (error) return 'lookup-failed';
  if (!data) return 'absent';
  return data.is_active === false ? 'retired' : 'owned';
}
