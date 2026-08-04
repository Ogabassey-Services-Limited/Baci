/** Selects one model identifier per product, falling back from a name to its slug. */
export function getProductModelIdentifiersFromSources(
  productNames: readonly string[] | undefined,
  productSlugs: readonly string[] | undefined,
  getIdentifier: (source: string) => string | null | undefined
) {
  const names = productNames ?? [];
  const slugs = productSlugs ?? [];
  const primarySources = names.length > 0 ? names : slugs;

  return Array.from(
    new Set(
      primarySources
        .map((source, index) =>
          [source, names.length > 0 ? slugs[index] : undefined]
            .filter((value): value is string => Boolean(value))
            .map(getIdentifier)
            .find(Boolean)
        )
        .filter((identifier): identifier is string => Boolean(identifier))
    )
  );
}
