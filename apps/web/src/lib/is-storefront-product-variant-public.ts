interface StorefrontVariantVisibility {
  archived_at?: string | null;
  deleted_at?: string | null;
  is_active?: boolean | null;
  is_inventory_anchor?: boolean | null;
  status?: string | null;
}

export function isStorefrontProductVariantPublic(
  variant: StorefrontVariantVisibility
): boolean {
  return !(
    variant.is_active === false ||
    variant.is_inventory_anchor === true ||
    variant.deleted_at != null ||
    variant.archived_at != null ||
    (variant.status != null && variant.status !== 'active')
  );
}
