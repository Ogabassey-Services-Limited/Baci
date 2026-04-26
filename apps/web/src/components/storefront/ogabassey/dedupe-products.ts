function getProductIdentities(product: unknown): string[] {
  if (typeof product !== 'object' || product === null) {
    return [];
  }

  const identities: string[] = [];

  if ('id' in product && product.id !== undefined && product.id !== null) {
    const normalizedId = String(product.id).trim();

    if (normalizedId) {
      identities.push(`id:${normalizedId}`);
    }
  }

  if ('slug' in product && typeof product.slug === 'string') {
    const normalizedSlug = product.slug.trim().toLowerCase();

    if (normalizedSlug) {
      identities.push(`slug:${normalizedSlug}`);
    }
  }

  return identities;
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
export function dedupeProductsByIdentity<T>(
  products: readonly T[]
): T[] {
  const seen = new Set<string>();
  const uniqueProducts: T[] = [];

  for (const product of products) {
    const identities = getProductIdentities(product);

    if (identities.length === 0) {
      uniqueProducts.push(product);
      continue;
    }

    const isDuplicate = identities.some((identity) => seen.has(identity));

    for (const identity of identities) {
      seen.add(identity);
    }

    if (isDuplicate) {
      continue;
    }

    uniqueProducts.push(product);
  }

  return uniqueProducts;
}
