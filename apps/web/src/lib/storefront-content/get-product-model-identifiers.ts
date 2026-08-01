import { CONTENT_CLUSTER_SUPPORT } from '@/config/storefront-content-clusters';
import type { BuildCommercialGuideLinksContext } from './content-cluster-types';

function tokenize(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 || /\d/u.test(token));
}

const SPECIFICATION_TOKEN_PATTERN =
  /^\d+(?:gb|tb|mb|g|inch|in|hz|mah|mp|w|v|mm|cm|kg)$/u;
const YEAR_TOKEN_PATTERN = /^(?:19|20)\d{2}$/u;

function getBrandAliasTokens(
  context: Pick<BuildCommercialGuideLinksContext, 'categorySlug' | 'brands'>
) {
  const contextBrandTokens = new Set((context.brands ?? []).flatMap(tokenize));

  return Object.entries(
    CONTENT_CLUSTER_SUPPORT[context.categorySlug].brandTokens
  ).flatMap(([brandKey, aliases]) => {
    const aliasTokens = [brandKey, ...aliases].flatMap(tokenize);
    return aliasTokens.some((token) => contextBrandTokens.has(token))
      ? aliasTokens
      : [];
  });
}

function isDimensionToken(tokens: string[], index: number) {
  const token = tokens[index];
  if (!/^\d+$/u.test(token)) {
    return false;
  }

  return (
    ['in', 'inch'].includes(tokens[index - 1] ?? '') ||
    ['in', 'inch'].includes(tokens[index + 1] ?? '')
  );
}

function getModelTokens(slug: string, excludedTokens: ReadonlySet<string>) {
  const tokens = tokenize(slug).filter((token) => !excludedTokens.has(token));
  return tokens.filter(
    (token, index) =>
      !SPECIFICATION_TOKEN_PATTERN.test(token) &&
      !YEAR_TOKEN_PATTERN.test(token) &&
      !isDimensionToken(tokens, index)
  );
}

/**
 * Returns compact, model-specific identifiers for the supplied catalog slugs.
 * Brand and category words are deliberately removed so a generic brand guide
 * cannot receive a product-match boost merely by repeating the hub context.
 */
export function getProductModelIdentifiers(
  context: Pick<
    BuildCommercialGuideLinksContext,
    'categorySlug' | 'brands' | 'productSlugs'
  >
) {
  const excludedTokens = new Set(
    [
      ...(context.brands ?? []).flatMap(tokenize),
      ...getBrandAliasTokens(context),
      ...CONTENT_CLUSTER_SUPPORT[context.categorySlug].categoryNames.flatMap(
        tokenize
      ),
    ].filter(Boolean)
  );

  return Array.from(
    new Set(
      (context.productSlugs ?? [])
        .map((slug) => getModelTokens(slug, excludedTokens))
        .map(
          (tokens) =>
            tokens.find((token) => /[a-z]/u.test(token) && /\d/u.test(token)) ??
            tokens.find((token) => /\d/u.test(token)) ??
            tokens[0] ??
            null
        )
        .filter((token): token is string => Boolean(token))
    )
  );
}
