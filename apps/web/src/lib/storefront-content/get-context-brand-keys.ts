import { generateSlug } from '@/lib/seo-utils';
import { tokenizeContentText } from './tokenize-content-text';

/** Resolves configured canonical brands from explicit context or product names. */
export function getContextBrandKeys(
  brands: readonly string[] | undefined,
  productNames: readonly string[] | undefined,
  brandAliases: Record<string, readonly string[]>
) {
  const explicitBrandKeys = Array.from(
    new Set((brands ?? []).map(generateSlug).filter(Boolean))
  );
  if (explicitBrandKeys.length > 0) {
    return explicitBrandKeys;
  }

  const productNameTokens = new Set(
    (productNames ?? []).flatMap(tokenizeContentText)
  );
  const canonicalKeys = Object.keys(brandAliases).filter((brand) =>
    tokenizeContentText(brand).every((token) => productNameTokens.has(token))
  );
  if (canonicalKeys.length > 0) {
    return canonicalKeys;
  }

  return Object.entries(brandAliases)
    .filter(([, aliases]) =>
      aliases.some((alias) =>
        tokenizeContentText(alias).every((token) =>
          productNameTokens.has(token)
        )
      )
    )
    .map(([brand]) => brand);
}
