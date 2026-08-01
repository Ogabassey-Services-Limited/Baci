import { CONTENT_CLUSTER_SUPPORT } from '@/config/storefront-content-clusters';
import type { BuildCommercialGuideLinksContext } from './content-cluster-types';
import { normalizeProductModelTokens } from './normalize-product-model-tokens';

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
const MODEL_FAMILY_ALIAS_TOKENS = new Set(['legion', 'pavilion']);
const MODEL_LINE_MARKER_TOKENS = new Set(['air', 'pro']);

interface BrandAliasGroup {
  brandTokens: string[];
  aliases: string[][];
}

function getBrandAliasGroups(
  context: Pick<
    BuildCommercialGuideLinksContext,
    'categorySlug' | 'brands' | 'productSlugs'
  >
): BrandAliasGroup[] {
  const contextBrandTokens = new Set(
    [...(context.brands ?? []), ...(context.productSlugs ?? [])].flatMap(
      tokenize
    )
  );

  return Object.entries(
    CONTENT_CLUSTER_SUPPORT[context.categorySlug].brandTokens
  ).flatMap(([brandKey, aliases]) => {
    const brandTokens = tokenize(brandKey);
    const aliasTokens = aliases.map(tokenize);
    const matchesContext = [brandTokens, ...aliasTokens].some(
      (tokens: string[]) =>
        tokens.some((token) => contextBrandTokens.has(token))
    );

    return matchesContext ? [{ brandTokens, aliases: aliasTokens }] : [];
  });
}

function getExcludedTokensForSlug(
  slug: string,
  baseExcludedTokens: ReadonlySet<string>,
  brandAliasGroups: readonly BrandAliasGroup[],
  protectedFamilyTokens: ReadonlySet<string>
) {
  const slugTokens = tokenize(slug);
  const excludedTokens = new Set(baseExcludedTokens);

  for (const group of brandAliasGroups) {
    for (const token of group.brandTokens) {
      if (slugTokens.includes(token) && !protectedFamilyTokens.has(token)) {
        excludedTokens.add(token);
      }
    }

    for (const aliasTokens of group.aliases) {
      if (
        aliasTokens.length === 0 ||
        !aliasTokens.every((token) => slugTokens.includes(token))
      ) {
        continue;
      }

      if (aliasTokens.some((token) => protectedFamilyTokens.has(token))) {
        continue;
      }

      const leavesModelToken = slugTokens.some((token, index) => {
        if (excludedTokens.has(token) || aliasTokens.includes(token)) {
          return false;
        }

        return (
          !SPECIFICATION_TOKEN_PATTERN.test(token) &&
          !YEAR_TOKEN_PATTERN.test(token) &&
          !isDimensionToken(slugTokens, index)
        );
      });

      const isModelFamilyAlias = aliasTokens.some((token) =>
        MODEL_FAMILY_ALIAS_TOKENS.has(token)
      );
      if (
        !isModelFamilyAlias &&
        (aliasTokens.length === 1 || leavesModelToken)
      ) {
        for (const token of aliasTokens) {
          excludedTokens.add(token);
        }
      }
    }
  }

  return excludedTokens;
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

function stripTrailingProcessorTier(tokens: string[]) {
  const processorIndex = tokens.findIndex(
    (token, index) =>
      token === 'ultra' && /^\d+$/u.test(tokens[index + 1] ?? '')
  );
  return processorIndex > 0 ? tokens.slice(0, processorIndex) : tokens;
}

function getModelTokens(slug: string, excludedTokens: ReadonlySet<string>) {
  const rawTokens = normalizeProductModelTokens(tokenize(slug)).filter(
    (token) => !excludedTokens.has(token)
  );
  const tokens =
    rawTokens.length > 1 &&
    COLLISION_SUFFIX_PATTERN.test(rawTokens[rawTokens.length - 1] ?? '') &&
    /\d/u.test(rawTokens[rawTokens.length - 2] ?? '')
      ? rawTokens.slice(0, -1)
      : rawTokens;
  const modelTokens = tokens.filter(
    (token, index) =>
      !SPECIFICATION_TOKEN_PATTERN.test(token) &&
      !YEAR_TOKEN_PATTERN.test(token) &&
      !['in', 'inch'].includes(token) &&
      !isDimensionToken(tokens, index)
  );
  return stripTrailingProcessorTier(modelTokens);
}

function getModelIdentifier(tokens: string[]) {
  const numericIndex = tokens.findLastIndex((token) => /^\d+$/u.test(token));
  if (numericIndex >= 0) {
    const phraseTokens = tokens.filter(
      (token, index) =>
        index === numericIndex ||
        (!/^\d+$/u.test(token) &&
          token.length > 1 &&
          !GENERIC_MODEL_MARKER_TOKENS.has(token))
    );
    return phraseTokens.join(' ');
  }

  const alphanumericToken = tokens.find(
    (token) => /[a-z]/u.test(token) && /\d/u.test(token)
  );
  if (alphanumericToken) {
    const alphanumericIndex = tokens.indexOf(alphanumericToken);
    const prefixTokens = tokens
      .slice(0, alphanumericIndex)
      .filter((token) => MODEL_LINE_MARKER_TOKENS.has(token));
    const suffixTokens = tokens
      .slice(alphanumericIndex + 1)
      .filter(
        (token) =>
          !/^\d+$/u.test(token) &&
          token.length > 1 &&
          !GENERIC_MODEL_MARKER_TOKENS.has(token)
      );
    const phraseTokens = [...prefixTokens, alphanumericToken, ...suffixTokens];
    return phraseTokens.join(' ');
  }

  const phraseTokens = tokens.filter(
    (token) => token.length > 1 && !GENERIC_MODEL_MARKER_TOKENS.has(token)
  );
  return phraseTokens.join(' ') || tokens[0] || null;
}

/**
 * Returns compact, model-specific identifiers for the supplied catalog slugs.
 * Brand and category words are deliberately removed so a generic brand guide
 * cannot receive a product-match boost merely by repeating the hub context.
 */
export function getProductModelIdentifiers(
  context: Pick<
    BuildCommercialGuideLinksContext,
    'categorySlug' | 'brands' | 'modelFamilySlug' | 'productSlugs'
  >
) {
  const protectedFamilyTokens = new Set(
    tokenize(context.modelFamilySlug ?? '')
  );
  const baseExcludedTokens = new Set(
    [
      ...(context.brands ?? []).flatMap(tokenize),
      ...CONTENT_CLUSTER_SUPPORT[context.categorySlug].categoryNames.flatMap(
        (name) =>
          tokenize(name).flatMap((token) => [
            token,
            ...(token.endsWith('s') && token.length > 3
              ? [token.slice(0, -1)]
              : []),
          ])
      ),
    ].filter((token) => Boolean(token) && !protectedFamilyTokens.has(token))
  );
  const brandAliasGroups = getBrandAliasGroups(context);

  return Array.from(
    new Set(
      (context.productSlugs ?? [])
        .map((slug) =>
          getModelTokens(
            slug,
            getExcludedTokensForSlug(
              slug,
              baseExcludedTokens,
              brandAliasGroups,
              protectedFamilyTokens
            )
          )
        )
        .map(getModelIdentifier)
        .filter((token): token is string => Boolean(token))
    )
  );
}
