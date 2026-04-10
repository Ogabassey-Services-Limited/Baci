import { formatVariantAttributesSummary } from '@/lib/format-variant-attributes';

interface ProductPickerRow {
  condition?: string | null;
  name: string;
  sku?: string | null;
  variant_attributes?: unknown;
}

export function getProductPickerRowTitle(
  product: Pick<ProductPickerRow, 'name'>,
  parentName?: string | null
): string {
  const normalizedName = product.name.trim();
  const normalizedParent = parentName?.trim();

  if (!normalizedParent) {
    return normalizedName;
  }

  if (
    normalizedName.localeCompare(normalizedParent, undefined, {
      sensitivity: 'accent',
      usage: 'search',
    }) === 0
  ) {
    return normalizedName;
  }

  if (normalizedName.toLowerCase().startsWith(normalizedParent.toLowerCase())) {
    const suffix = normalizedName.slice(normalizedParent.length).trim();
    if (suffix) {
      return suffix;
    }
  }

  return normalizedName;
}

export function getProductPickerRowSubtitle(product: ProductPickerRow): string {
  const conditionLabel = product.condition?.replace(/_/g, ' ') ?? null;
  const variantSummary = formatVariantAttributesSummary(
    product.variant_attributes
  );

  return (
    [conditionLabel, variantSummary, product.sku ? `SKU: ${product.sku}` : null]
      .filter(Boolean)
      .join(' · ') || 'N/A'
  );
}
