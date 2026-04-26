function getProductIdentity(product: object): string | null {
  if ('id' in product && product.id !== undefined && product.id !== null) {
    const normalizedId = String(product.id).trim();

    if (normalizedId) {
      return `id:${normalizedId}`;
    }
  }

  if ('slug' in product && typeof product.slug === 'string') {
    const normalizedSlug = product.slug.trim().toLowerCase();

    if (normalizedSlug) {
      return `slug:${normalizedSlug}`;
    }
  }

  return null;
}

/**
 * Returns products with duplicate identities removed.
 *
 * @param products - Product-like objects to scan.
 * @returns Products in first-seen order, excluding repeated identity strings.
 *
 * Products without an id or slug are always retained because they do not have
 * a stable identity key to compare.
 */
export function dedupeProductsByIdentity<T extends object>(
  products: readonly T[]
): T[] {
  const seen = new Set<string>();
  const uniqueProducts: T[] = [];

  for (const product of products) {
    const identity = getProductIdentity(product);

    if (!identity) {
      uniqueProducts.push(product);
      continue;
    }

    if (seen.has(identity)) {
      continue;
    }

    seen.add(identity);
    uniqueProducts.push(product);
  }

  return uniqueProducts;
}
