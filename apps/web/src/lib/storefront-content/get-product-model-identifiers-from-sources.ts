/** Selects one model identifier per product, falling back from a name to its slug. */
const VARIANT_METADATA_TOKEN_PATTERN =
  /^(?:\d+(?:gb|tb|mb|mm|inch)?|4g|5g|bluetooth|bt|cellular|dual|esim|gps|lte|nano|physical|sim|single|wifi)$/u;

function selectMostSpecificIdentifier(
  identifiers: readonly string[]
): string | undefined {
  return identifiers.reduce<string | undefined>((selected, candidate) => {
    if (!selected) {
      return candidate;
    }
    const selectedTokens = selected.split(/\s+/u);
    const candidateTokens = candidate.split(/\s+/u);
    let selectedIndex = 0;
    for (const token of candidateTokens) {
      if (token === selectedTokens[selectedIndex]) {
        selectedIndex += 1;
      }
    }
    const extendsSelected = selectedIndex === selectedTokens.length;
    const extensionTokens = candidateTokens.filter(
      (token) => !selectedTokens.includes(token)
    );
    const addsModelSpecificity = extensionTokens.some(
      (token) =>
        !VARIANT_METADATA_TOKEN_PATTERN.test(token) ||
        (/^\d+$/u.test(token) &&
          selectedTokens.some((selectedToken) => /[a-z]/u.test(selectedToken)))
    );
    return extendsSelected && addsModelSpecificity ? candidate : selected;
  }, undefined);
}

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
        .map((source, index) => {
          const identifiers = [
            source,
            names.length > 0 ? slugs[index] : undefined,
          ]
            .filter((value): value is string => Boolean(value))
            .map(getIdentifier)
            .filter((identifier): identifier is string => Boolean(identifier));
          return selectMostSpecificIdentifier(identifiers);
        })
        .filter((identifier): identifier is string => Boolean(identifier))
    )
  );
}
