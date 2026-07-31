export function extractProductListVariantAttributes(
  variants: Record<string, unknown>[]
): {
  colors: string[];
  storage_options: string[];
  available_sizes: string[];
} {
  const colors = new Set<string>();
  const storage = new Set<string>();
  const sizes = new Set<string>();
  for (const variant of variants) {
    const attributes = variant.attributes as Record<string, string> | undefined;
    if (attributes?.color) colors.add(attributes.color);
    if (attributes?.storage) storage.add(attributes.storage);
    if (attributes?.size) sizes.add(attributes.size);
  }
  return {
    colors: [...colors],
    storage_options: [...storage],
    available_sizes: [...sizes],
  };
}
