import type { UpdateMerchantCategoryInput } from '@/schemas/update-merchant-category';

/**
 * Map a validated PATCH body to the `categories` columns it touches.
 *
 * Only fields the caller actually sent are included, so a partial update never
 * blanks a column it did not mention. `name` and `description` arrive already
 * sanitized — the schema does that BEFORE its non-empty check, so a
 * markup-only name cannot reach the database as an empty string.
 */
export function buildCategoryUpdatePayload(
  input: UpdateMerchantCategoryInput,
  updatedAt: string
): Record<string, unknown> {
  const updates: Record<string, unknown> = { updated_at: updatedAt };

  if (input.name !== undefined) updates.name = input.name;
  if (input.slug !== undefined) updates.slug = input.slug;
  if (input.description !== undefined)
    updates.description = input.description || null;
  if (input.imageUrl !== undefined) updates.image_url = input.imageUrl;
  if (input.parentId !== undefined) updates.parent_id = input.parentId;
  if (input.displayOrder !== undefined)
    updates.display_order = input.displayOrder;
  // The database trigger owns transition-aware SEO cleanup. Clearing here on
  // every `isActive: true` edit would erase SEO from an already-active row.
  if (input.isActive !== undefined) updates.is_active = input.isActive;

  return updates;
}
