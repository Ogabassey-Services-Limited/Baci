import { CONTENT_CLUSTER_SUPPORT } from '@/config/storefront-content-clusters';
import { applyJoinedTitleCorrections } from './apply-joined-title-corrections';
import type { BuildCommercialGuideLinksContext } from './content-cluster-types';
import { isBareCapacityMetadataToken } from './is-bare-capacity-metadata-token';
import { modelTokenMatchers } from './model-token-matchers';
import { normalizeContentCurrencyTokens } from './normalize-content-currency-tokens';
import { normalizeProductModelTokens } from './normalize-product-model-tokens';
import { selectProductModelIdentifier } from './select-product-model-identifier';

const { isConvertibleInConnector, isDimensionToken } = modelTokenMatchers;

function tokenize(value: string) {
  return normalizeContentCurrencyTokens(value)
    .replace(/(\d{1,2}(?:\.\d+)?)\s*["″”]/gu, '$1 inch')
    .toLowerCase()
    .replace(/[’']s\b/gu, '')
    .replace(/\+/gu, ' plus ')
    .split(/[^a-z0-9]+/u)
    .map((token) => token.trim())
    .filter(
      (token) => token.length > 1 || /\d/u.test(token) || /^[a-z]$/u.test(token)
    );
}
const MODEL_METADATA_TOKEN_PATTERN =
  /^(?:ram|vram|\d+(?:gb|tb|mb|g|inch|in|hz|mah|mp|w|v|mm|cm|kg)|\d{4,}[a-z]{2,})$/u;
const YEAR_TOKEN_PATTERN = /^(?:19|20)\d{2}$/u;
const MODEL_FAMILY_ALIAS_TOKENS = new Set([
  'airpods',
  'buds',
  'legion',
  'laserjet',
  'pavilion',
  'quest',
  'redmi',
  'series',
  'thinkpad',
  'watch',
]);
const LAPTOP_CATEGORY_SLUGS = new Set(['gaming-laptops', 'laptops']);
const DISPLAY_SIZE_CATEGORY_SLUGS = new Set(LAPTOP_CATEGORY_SLUGS).add(
  'tablets'
);
const GAME_CATEGORY_PATTERN =
  /^(?:gaming|playstation-[45]|nintendo-switch(?:-2)?|xbox)$/u;
const LEADING_FILLER_TOKENS = new Set(['a', 'an', 'headset', 'the']);
interface BrandAliasGroup {
  brandTokens: string[];
  aliases: string[][];
}
function getBrandAliasGroups(
  context: Omit<BuildCommercialGuideLinksContext, 'pageKind'>
): BrandAliasGroup[] {
  const contextBrandTokens = new Set(
    [
      ...(context.brands ?? []),
      ...(context.productSlugs ?? []),
      ...(context.productNames ?? []),
    ].flatMap(tokenize)
  );
  return Object.entries(
    CONTENT_CLUSTER_SUPPORT[context.categorySlug].brandTokens
  ).flatMap(([brandKey, aliases]) => {
    if (brandKey === 'gaming') return [];
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
      if (
        slugTokens.includes(token) &&
        !protectedFamilyTokens.has(token) &&
        !MODEL_FAMILY_ALIAS_TOKENS.has(token)
      ) {
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
          !MODEL_METADATA_TOKEN_PATTERN.test(token) &&
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
function stripTrailingProcessorTier(tokens: string[], categorySlug: string) {
  if (!LAPTOP_CATEGORY_SLUGS.has(categorySlug)) {
    return tokens;
  }
  const processorIndex = tokens.findIndex(
    (token, index) =>
      ((token === 'ultra' || token === 'rtx') &&
        /^\d+$/u.test(tokens[index + 1] ?? '')) ||
      (token === 'core' && /^i[3579]$/u.test(tokens[index + 1] ?? '')) ||
      /^i[3579]$/u.test(token)
  );
  return processorIndex > 0 ? tokens.slice(0, processorIndex) : tokens;
}
function stripLeadingFillerTokens(tokens: string[]) {
  const firstModelToken = tokens.findIndex(
    (token) => !LEADING_FILLER_TOKENS.has(token)
  );
  return tokens.slice(firstModelToken < 0 ? tokens.length : firstModelToken);
}
function stripLeadingDisplaySize(tokens: string[], categorySlug: string) {
  if (!DISPLAY_SIZE_CATEGORY_SLUGS.has(categorySlug)) {
    return tokens;
  }
  const [firstToken = '', nextToken = ''] = tokens;
  const displaySize = Number(firstToken);
  const hasFollowingModelText = tokens
    .slice(1)
    .some((token) => /[a-z]/u.test(token));
  const hasConvertibleModel = tokens.some((_, index) =>
    isConvertibleInConnector(tokens, index)
  );
  const isIntegerDisplayPrefix =
    /^\d{2}$/u.test(firstToken) &&
    displaySize >= 10 &&
    displaySize <= 20 &&
    !isDimensionToken(tokens, 1);
  const isTabletDecimalDisplayPrefix =
    categorySlug === 'tablets' &&
    /^\d$/u.test(firstToken) &&
    /^\d$/u.test(nextToken) &&
    Number(`${firstToken}.${nextToken}`) >= 7 &&
    Number(`${firstToken}.${nextToken}`) <= 20;
  return (isIntegerDisplayPrefix || isTabletDecimalDisplayPrefix) &&
    hasFollowingModelText &&
    !hasConvertibleModel
    ? tokens.slice(
        isTabletDecimalDisplayPrefix || /^\d$/u.test(nextToken) ? 2 : 1
      )
    : tokens;
}
function isModelMetadataToken(token: string, categorySlug: string) {
  return (
    categorySlug !== 'printers' && MODEL_METADATA_TOKEN_PATTERN.test(token)
  );
}
function stripGeneratedCollisionSuffix(tokens: string[]) {
  const lastToken = tokens.at(-1) ?? '';
  if (tokens.length < 2 || !/^\d$/u.test(lastToken)) {
    return tokens;
  }
  const previousToken = tokens.at(-2) ?? '';
  if (previousToken === 'in' && /^\d+$/u.test(tokens.at(-3) ?? '')) {
    return tokens;
  }
  if (/\d/u.test(previousToken)) {
    return tokens.slice(0, -1);
  }
  const precedingNumericIndex = tokens.findLastIndex(
    (token, index) => index < tokens.length - 1 && /^\d+$/u.test(token)
  );
  return precedingNumericIndex >= 0 && precedingNumericIndex < tokens.length - 2
    ? tokens.slice(0, -1)
    : tokens;
}
function getModelTokens(
  slug: string,
  excludedTokens: ReadonlySet<string>,
  categorySlug: string
) {
  const canonicalSlug = applyJoinedTitleCorrections(slug);
  const rawTokens = normalizeProductModelTokens(
    tokenize(
      canonicalSlug
        .replace(/\bplay[\s-]+station\b/gu, 'playstation')
        .replace(/([a-z]{3,})-s-(?=[a-z])/gu, '$1-')
    ).filter((token) => !excludedTokens.has(token)),
    GAME_CATEGORY_PATTERN.test(categorySlug),
    DISPLAY_SIZE_CATEGORY_SLUGS.has(categorySlug)
  );
  const platformGeneration = categorySlug.match(/^playstation-(\d+)$/u)?.[1];
  const platformStrippedTokens =
    platformGeneration && rawTokens[0] === platformGeneration
      ? rawTokens.slice(1)
      : rawTokens;
  const tokens = GAME_CATEGORY_PATTERN.test(categorySlug)
    ? platformStrippedTokens
    : stripGeneratedCollisionSuffix(
        stripLeadingDisplaySize(platformStrippedTokens, categorySlug)
      );
  const modelTokens = tokens.filter(
    (token, index) =>
      !isModelMetadataToken(token, categorySlug) &&
      !isBareCapacityMetadataToken(tokens, index) &&
      token !== 'inch' &&
      (token !== 'in' ||
        GAME_CATEGORY_PATTERN.test(categorySlug) ||
        isConvertibleInConnector(tokens, index)) &&
      !isDimensionToken(tokens, index)
  );
  return stripTrailingProcessorTier(
    stripLeadingFillerTokens(modelTokens),
    categorySlug
  );
}
export function getProductModelIdentifiers(
  context: Omit<BuildCommercialGuideLinksContext, 'pageKind'>
) {
  const protectedFamilyTokens = new Set([
    ...tokenize(context.modelFamilySlug ?? ''),
    ...(context.categorySlug === 'nintendo-switch-2' ? ['switch'] : []),
    ...(context.categorySlug === 'vr-headsets' ? ['vr'] : []),
  ]);
  const isGameCategory = GAME_CATEGORY_PATTERN.test(context.categorySlug);
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
      'pc',
      ...(isGameCategory ? ['console'] : []),
    ].filter(
      (token) =>
        Boolean(token) &&
        !(isGameCategory && /^\d+$/u.test(token)) &&
        !protectedFamilyTokens.has(token) &&
        !MODEL_FAMILY_ALIAS_TOKENS.has(token)
    )
  );
  const brandAliasGroups = getBrandAliasGroups(context);
  const productSources = context.productNames?.length
    ? context.productNames
    : (context.productSlugs ?? []);
  return Array.from(
    new Set(
      productSources
        .map((slug) =>
          getModelTokens(
            slug,
            getExcludedTokensForSlug(
              slug,
              baseExcludedTokens,
              brandAliasGroups,
              protectedFamilyTokens
            ),
            context.categorySlug
          )
        )
        .map((tokens) => selectProductModelIdentifier(tokens, isGameCategory))
        .filter((token): token is string => Boolean(token))
    )
  );
}
