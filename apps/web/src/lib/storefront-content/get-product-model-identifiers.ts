import { CONTENT_CLUSTER_SUPPORT } from '@/config/storefront-content-clusters';
import type { BuildCommercialGuideLinksContext } from './content-cluster-types';

function tokenize(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .map((token) => token.trim())
    .filter(
      (token) => token.length > 1 || /\d/u.test(token) || /^[a-z]$/u.test(token)
    );
}

const SPECIFICATION_TOKEN_PATTERN =
  /^\d+(?:gb|tb|mb|g|inch|in|hz|mah|mp|w|v|mm|cm|kg)$/u;
const YEAR_TOKEN_PATTERN = /^(?:19|20)\d{2}$/u;
const COLLISION_SUFFIX_PATTERN = /^\d{1,2}$/u;
const GENERIC_MODEL_MARKER_TOKENS = new Set([
  'edition',
  'model',
  'new',
  'series',
  'version',
]);

function getBrandAliasTokens(
  context: Pick<
    BuildCommercialGuideLinksContext,
    'categorySlug' | 'brands' | 'productSlugs'
  >
) {
  const contextBrandTokens = new Set(
    [...(context.brands ?? []), ...(context.productSlugs ?? [])].flatMap(
      tokenize
    )
  );

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
  const rawTokens = tokenize(slug).filter(
    (token) => !excludedTokens.has(token)
  );
  const tokens =
    rawTokens.length > 1 &&
    COLLISION_SUFFIX_PATTERN.test(rawTokens[rawTokens.length - 1] ?? '') &&
    /\d/u.test(rawTokens[rawTokens.length - 2] ?? '')
      ? rawTokens.slice(0, -1)
      : rawTokens;
  return tokens.filter(
    (token, index) =>
      !SPECIFICATION_TOKEN_PATTERN.test(token) &&
      !YEAR_TOKEN_PATTERN.test(token) &&
      !isDimensionToken(tokens, index)
  );
}

function getModelIdentifier(tokens: string[]) {
  const alphanumericToken = tokens.find(
    (token) => /[a-z]/u.test(token) && /\d/u.test(token)
  );
  if (alphanumericToken) {
    return alphanumericToken;
  }

  const numericIndex = tokens.findLastIndex((token) => /\d/u.test(token));
  if (numericIndex >= 0) {
    const numericToken = tokens[numericIndex];
    const familyToken = [
      ...tokens.slice(0, numericIndex).reverse(),
      ...tokens.slice(numericIndex + 1),
    ].find(
      (token) =>
        !/\d/u.test(token) &&
        token.length > 1 &&
        !GENERIC_MODEL_MARKER_TOKENS.has(token)
    );
    return familyToken ? `${familyToken} ${numericToken}` : numericToken;
  }

  return tokens.find((token) => token.length > 1) ?? tokens[0] ?? null;
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
        (name) =>
          tokenize(name).flatMap((token) => [
            token,
            ...(token.endsWith('s') && token.length > 3
              ? [token.slice(0, -1)]
              : []),
          ])
      ),
    ].filter(Boolean)
  );

  return Array.from(
    new Set(
      (context.productSlugs ?? [])
        .map((slug) => getModelTokens(slug, excludedTokens))
        .map(getModelIdentifier)
        .filter((token): token is string => Boolean(token))
    )
  );
}
