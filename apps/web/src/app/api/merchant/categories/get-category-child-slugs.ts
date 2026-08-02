import type { CategoryRouteContext } from './category-route-support';

export type CategoryChildSlugsResult =
  | { ok: true; slugs: string[] }
  | { ok: false };

/** Capture child tags before the atomic retirement trigger promotes them. */
export async function getCategoryChildSlugs(
  supabase: CategoryRouteContext['supabase'],
  merchantId: string,
  parentId: string
): Promise<CategoryChildSlugsResult> {
  const { data, error } = await supabase
    .from('categories')
    .select('slug')
    .eq('merchant_id', merchantId)
    .eq('parent_id', parentId);

  if (error) return { ok: false };
  return {
    ok: true,
    slugs: (data ?? [])
      .map((category) => category.slug)
      .filter((slug): slug is string => typeof slug === 'string'),
  };
}
