import type { CategoryRouteContext } from './category-route-types';

const MAX_CATEGORY_DEPTH = 32;

export type CategoryCycleResult = 'safe' | 'cycle' | 'lookup-failed';

/** Walk ancestors and fail closed if a proposed parent would create a cycle. */
export async function wouldCreateCategoryCycle(
  supabase: CategoryRouteContext['supabase'],
  merchantId: string,
  categoryId: string,
  parentId: string
): Promise<CategoryCycleResult> {
  if (parentId === categoryId) return 'cycle';

  let cursor: string | null = parentId;
  const seen = new Set<string>([categoryId]);

  for (let depth = 0; depth < MAX_CATEGORY_DEPTH; depth += 1) {
    if (cursor === null) return 'safe';
    if (seen.has(cursor)) return 'cycle';
    seen.add(cursor);

    const result: {
      data: { parent_id: string | null } | null;
      error: unknown;
    } = await supabase
      .from('categories')
      .select('parent_id')
      .eq('id', cursor)
      .eq('merchant_id', merchantId)
      .maybeSingle();

    if (result.error) return 'lookup-failed';
    if (!result.data) return 'safe';
    cursor = result.data.parent_id;
  }

  return cursor === null ? 'safe' : 'cycle';
}
