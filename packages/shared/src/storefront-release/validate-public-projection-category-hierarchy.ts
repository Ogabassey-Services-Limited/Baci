import type { RefinementCtx } from 'zod';

type PublicProjectionCategory = Readonly<{
  id: string;
  parentId?: string | null;
}>;

/** Rejects cyclic parent chains in a public storefront category projection. */
export function validatePublicProjectionCategoryHierarchy(
  categories: readonly PublicProjectionCategory[],
  context: RefinementCtx
): void {
  const categoryParents = new Map(
    categories.map((category) => [category.id, category.parentId])
  );
  for (const [categoryIndex, category] of categories.entries()) {
    const visited = new Set<string>();
    let hasCycle = false;
    let current: string | null | undefined = category.id;
    while (current) {
      if (visited.has(current)) {
        hasCycle = true;
        context.addIssue({
          code: 'custom',
          message: 'Category parent relationships must be acyclic',
          path: ['categories', categoryIndex, 'parentId'],
        });
        break;
      }
      visited.add(current);
      current = categoryParents.get(current);
    }
    if (
      !hasCycle &&
      category.parentId &&
      categoryParents.get(category.parentId)
    )
      context.addIssue({
        code: 'custom',
        message: 'Category hierarchies support at most two levels',
        path: ['categories', categoryIndex, 'parentId'],
      });
  }
}
