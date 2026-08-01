import { CONTENT_CLUSTER_SUPPORT } from '@/config/storefront-content-clusters';
import type { BuildCommercialGuideLinksContext } from './content-cluster-types';
import { normalizeProductModelTokens } from './normalize-product-model-tokens';
import { selectProductModelIdentifier } from './select-product-model-identifier';

function tokenize(value: string) {
  return value
    .toLowerCase()
    .replace(/[’']s\b/gu, '')
    .replace(/\+/gu, ' plus ')
    .split(/[^a-z0-9]+/u)
    .map((token) => token.trim())
    .filter(
      (token) => token.length > 1 || /\d/u.test(token) || /^[a-z]$/u.test(token)
    );
}
const SPECIFICATION_TOKEN_PATTERN =
  /^(?:ram|vram|\d+(?:gb|tb|mb|g|inch|in|hz|mah|mp|w|v|mm|cm|kg))$/u;
const YEAR_TOKEN_PATTERN = /^(?:19|20)\d{2}$/u;
const MODEL_FAMILY_ALIAS_TOKENS = new Set([
  'airpods',
  'legion',
  'pavilion',
  'quest',
  'redmi',
  'series',
  'watch',
]);
const LAPTOP_CATEGORY_SLUGS = new Set(['gaming-laptops', 'laptops']);
const DISPLAY_SIZE_CATEGORY_SLUGS = new Set(LAPTOP_CATEGORY_SLUGS).add(
  'tablets'
);
const GAME_CATEGORY_PATTERN =
  /^(?:gaming|playstation-[45]|nintendo-switch(?:-2)?|xbox)$/u;
const LEADING_FILLER_TOKENS = new Set(['a', 'an', 'the']);
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
  const previousToken = tokens[index - 1] ?? '';
  const nextToken = tokens[index + 1] ?? '';
  if (
    (previousToken === 'in' && isConvertibleInConnector(tokens, index - 1)) ||
    (nextToken === 'in' && isConvertibleInConnector(tokens, index + 1))
  ) {
    return false;
  }

  return (
    ['in', 'inch'].includes(previousToken) || ['in', 'inch'].includes(nextToken)
  );
}
function isConvertibleInConnector(tokens: string[], index: number) {
  return (
    tokens[index] === 'in' &&
    /^\d+$/u.test(tokens[index - 1] ?? '') &&
    /^\d+$/u.test(tokens[index + 1] ?? '')
  );
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
  let firstModelToken = 0;
  while (LEADING_FILLER_TOKENS.has(tokens[firstModelToken] ?? '')) {
    firstModelToken += 1;
  }
  return firstModelToken > 0 ? tokens.slice(firstModelToken) : tokens;
}
function stripLeadingDisplaySize(tokens: string[], categorySlug: string) {
  if (!DISPLAY_SIZE_CATEGORY_SLUGS.has(categorySlug)) {
    return tokens;
  }
  const firstToken = tokens[0] ?? '';
  const displaySize = Number(firstToken);
  const hasFollowingModelText = tokens
    .slice(1)
    .some((token) => /[a-z]/u.test(token));
  const hasConvertibleModel = tokens.some((_, index) =>
    isConvertibleInConnector(tokens, index)
  );
  return /^\d{2}$/u.test(firstToken) &&
    displaySize >= 10 &&
    displaySize <= 20 &&
    hasFollowingModelText &&
    !hasConvertibleModel
    ? tokens.slice(/^\d$/u.test(tokens[1] ?? '') ? 2 : 1)
    : tokens;
}
function stripGeneratedCollisionSuffix(tokens: string[]) {
  const lastToken = tokens.at(-1) ?? '';
  if (tokens.length < 2 || !/^\d$/u.test(lastToken)) {
    return tokens;
  }
  const previousToken = tokens.at(-2) ?? '';
  const isConvertibleSuffix =
    previousToken === 'in' && /^\d+$/u.test(tokens.at(-3) ?? '');
  if (isConvertibleSuffix) {
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

function stripGamePlatformGeneration(tokens: string[], categorySlug: string) {
  const generation = categorySlug.match(
    /^(?:playstation|nintendo-switch)-(\d+)$/u
  )?.[1];
  return generation && tokens[0] === generation ? tokens.slice(1) : tokens;
}
function getModelTokens(
  slug: string,
  excludedTokens: ReadonlySet<string>,
  categorySlug: string
) {
  const rawTokens = normalizeProductModelTokens(
    tokenize(slug.replace(/\bplay[\s-]+station\b/gu, 'playstation')).filter(
      (token) => !excludedTokens.has(token)
    ),
    GAME_CATEGORY_PATTERN.test(categorySlug)
  );
  const platformStrippedTokens = stripGamePlatformGeneration(
    rawTokens,
    categorySlug
  );
  const tokens = stripGeneratedCollisionSuffix(
    stripLeadingDisplaySize(platformStrippedTokens, categorySlug)
  );
  const modelTokens = tokens.filter(
    (token, index) =>
      !SPECIFICATION_TOKEN_PATTERN.test(token) &&
      token !== 'inch' &&
      (token !== 'in' || isConvertibleInConnector(tokens, index)) &&
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
  const protectedFamilyTokens = new Set(
    tokenize(context.modelFamilySlug ?? '')
  );
  const categoryExcludesNumericTokens = GAME_CATEGORY_PATTERN.test(
    context.categorySlug
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
      'pc',
    ].filter(
      (token) =>
        Boolean(token) &&
        !(categoryExcludesNumericTokens && /^\d+$/u.test(token)) &&
        !protectedFamilyTokens.has(token) &&
        !MODEL_FAMILY_ALIAS_TOKENS.has(token)
    )
  );
  const brandAliasGroups = getBrandAliasGroups(context);
  const preserveGameYears = categoryExcludesNumericTokens;
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
        .map((tokens) =>
          selectProductModelIdentifier(tokens, preserveGameYears)
        )
        .filter((token): token is string => Boolean(token))
    )
  );
}
