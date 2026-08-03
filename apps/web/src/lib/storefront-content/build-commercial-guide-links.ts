import {
  CONTENT_CLUSTER_SCORE,
  CONTENT_CLUSTER_SUPPORT,
} from '@/config/storefront-content-clusters';
import { generateSlug } from '@/lib/seo-utils';
import { buildCommercialGuideDescription } from './build-commercial-guide-description';
import type {
  BuildCommercialGuideLinksInput,
  CommercialGuidePageKind,
  ContentClusterKind,
  InformationalGuideLink,
} from './content-cluster-types';
import { getCompareProductMatchRequirements } from './get-compare-product-match-requirements';
import { getPostTokenGroups } from './get-post-token-groups';
import { getProductModelIdentifiers } from './get-product-model-identifiers';
import { hasCleanIdentifierOccurrence } from './has-clean-identifier-occurrence';
import { inferContentClusterContext } from './infer-content-cluster-context';
import { normalizeContentCurrencyTokens } from './normalize-content-currency-tokens';
import { tokenizeContentText } from './tokenize-content-text';

const KIND_PREFERENCE: Record<CommercialGuidePageKind, ContentClusterKind[]> = {
  category: ['buyer-guide', 'best-in-nigeria'],
  product: [],
  compare: ['decision-support', 'buyer-guide'],
  'price-band': ['best-in-nigeria', 'buyer-guide'],
};

const MODEL_FAMILY_CONTEXT_EXCLUSIONS = new Set(['and', 'or']);
const GAME_CATEGORY_PATTERN =
  /^(?:gaming|playstation-[45]|nintendo-switch(?:-2)?|xbox)$/u;
function toPublishedTimestamp(value: string | null) {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function tokenizeSlug(slug: string) {
  return normalizeContentCurrencyTokens(slug)
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length > 2);
}

function tokenizeModelIdentifier(identifier: string) {
  return normalizeContentCurrencyTokens(identifier)
    .split(/[^a-z0-9]+/iu)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
}

function hasContiguousTokenSequence(
  post: BuildCommercialGuideLinksInput['posts'][number],
  expectedTokens: string[]
) {
  if (expectedTokens.length === 0) {
    return false;
  }

  const postTokenGroups = getPostTokenGroups(post);

  return postTokenGroups.some((postTokens) =>
    postTokens.some((_, startIndex) =>
      expectedTokens.every(
        (token, offset) => postTokens[startIndex + offset] === token
      )
    )
  );
}

function matchesProductIdentifier(
  post: BuildCommercialGuideLinksInput['posts'][number],
  inferredTokens: string[],
  identifierTokens: string[],
  hasBrandMatch: boolean,
  occurrenceOptions?: Parameters<typeof hasCleanIdentifierOccurrence>[2]
) {
  if (
    identifierTokens.length === 0 ||
    (identifierTokens.every((token) => /^\d+$/u.test(token)) &&
      !hasBrandMatch &&
      !occurrenceOptions?.brand) ||
    !identifierTokens.every((token) => inferredTokens.includes(token))
  ) {
    return false;
  }

  return hasCleanIdentifierOccurrence(
    post,
    identifierTokens,
    occurrenceOptions
  );
}

function hasContextualFamilyMatch(
  post: BuildCommercialGuideLinksInput['posts'][number],
  familyTokens: string[],
  brands: string[]
) {
  if (familyTokens.length === 0) {
    return false;
  }

  const brandTokens = brands
    .flatMap(tokenizeContentText)
    .filter(
      (token) => token.length > 1 && !MODEL_FAMILY_CONTEXT_EXCLUSIONS.has(token)
    );

  return brandTokens.some(
    (brandToken) =>
      (familyTokens.includes(brandToken) &&
        hasContiguousTokenSequence(post, familyTokens)) ||
      hasContiguousTokenSequence(post, [brandToken, ...familyTokens]) ||
      hasContiguousTokenSequence(post, [...familyTokens, brandToken])
  );
}

function getContextBrandValues(
  brands: string[],
  brandAliases: Record<string, readonly string[]>
) {
  return Array.from(
    new Set([
      ...brands,
      ...brands.flatMap((brand) => brandAliases[generateSlug(brand)] ?? []),
    ])
  );
}

function buildGuideHref(storeUrl: string, slug: string) {
  return `${storeUrl}/blog/${slug}`;
}

export function buildCommercialGuideLinks(
  input: BuildCommercialGuideLinksInput
): InformationalGuideLink[] {
  const preferredKinds = KIND_PREFERENCE[input.context.pageKind];
  const brandAliases =
    CONTENT_CLUSTER_SUPPORT[input.context.categorySlug].brandTokens;
  const productModelIdentifiers = getProductModelIdentifiers(input.context);
  const compareProductMatchRequirements =
    input.context.pageKind === 'compare'
      ? getCompareProductMatchRequirements(input.context)
      : [];
  const modelFamilyTokens = tokenizeModelIdentifier(
    input.context.modelFamilySlug ?? ''
  );

  return input.posts
    .map((post) => {
      const inferred = inferContentClusterContext(post);

      if (
        inferred.categorySlug !== input.context.categorySlug ||
        !inferred.kind
      ) {
        return null;
      }

      let score = CONTENT_CLUSTER_SCORE.categoryMatch;

      if (preferredKinds.includes(inferred.kind)) {
        score += CONTENT_CLUSTER_SCORE.kindMatch;
      }

      const normalizedBrands = (input.context.brands ?? []).map((brand) =>
        generateSlug(brand)
      );
      const directBrandMatches = new Set(
        normalizedBrands.filter((brand) =>
          hasContiguousTokenSequence(post, tokenizeModelIdentifier(brand))
        )
      );
      const hasDirectBrandMatch = directBrandMatches.size > 0;
      const hasBrandMatch =
        normalizedBrands.length > 0 &&
        (hasDirectBrandMatch ||
          inferred.brands.some((brand) =>
            normalizedBrands.includes(generateSlug(brand))
          ));
      if (hasBrandMatch) {
        score += CONTENT_CLUSTER_SCORE.brandMatch;
      }

      if (
        input.context.priceBandSlug &&
        inferred.matchedPriceBands.includes(input.context.priceBandSlug)
      ) {
        score += CONTENT_CLUSTER_SCORE.priceBandMatch;
      }

      const shouldBindProductModelBrand =
        normalizedBrands.length > 0 &&
        !GAME_CATEGORY_PATTERN.test(input.context.categorySlug);
      const hasProductModelMatch = productModelIdentifiers.some((identifier) =>
        (shouldBindProductModelBrand ? normalizedBrands : [null]).some(
          (brand) =>
            matchesProductIdentifier(
              post,
              inferred.tokens,
              tokenizeModelIdentifier(identifier),
              hasBrandMatch,
              brand
                ? {
                    brand,
                    knownBrands: inferred.brands,
                    brandAliases,
                    requireBrandBeforeIdentifier: true,
                    allowBrandAliasOverlap: true,
                  }
                : undefined
            )
        )
      );
      const hasModelFamilyMatch =
        modelFamilyTokens.length > 0 &&
        hasBrandMatch &&
        modelFamilyTokens.every((token) => inferred.tokens.includes(token)) &&
        hasContextualFamilyMatch(
          post,
          modelFamilyTokens,
          getContextBrandValues(input.context.brands ?? [], brandAliases)
        );
      const hasRequiredCompareModelMatch =
        input.context.pageKind === 'compare' &&
        compareProductMatchRequirements.length > 0 &&
        compareProductMatchRequirements.every(
          ({ identifier, brand, discriminatorTokens }) =>
            (!brand ||
              inferred.brands.includes(brand) ||
              directBrandMatches.has(generateSlug(brand))) &&
            matchesProductIdentifier(
              post,
              inferred.tokens,
              tokenizeModelIdentifier(identifier),
              hasBrandMatch,
              {
                brand,
                knownBrands: inferred.brands,
                brandAliases,
                discriminatorTokens,
                requireBrandBeforeIdentifier: !GAME_CATEGORY_PATTERN.test(
                  input.context.categorySlug
                ),
                allowBrandAliasOverlap: true,
              }
            )
        );
      const qualifiesForProductTokenMatch =
        input.context.pageKind === 'compare'
          ? hasRequiredCompareModelMatch
          : hasProductModelMatch;
      if (qualifiesForProductTokenMatch || hasModelFamilyMatch) {
        score += CONTENT_CLUSTER_SCORE.productTokenMatch;
      }

      const titleTokens = tokenizeSlug(post.title);
      if (
        normalizedBrands.some((brand) =>
          titleTokens.includes(brand.replace(/-/g, ''))
        ) ||
        (input.context.priceBandSlug
          ? titleTokens.some((token) =>
              tokenizeSlug(input.context.priceBandSlug ?? '').includes(token)
            )
          : false)
      ) {
        score += CONTENT_CLUSTER_SCORE.titleTokenMatch;
      }

      if (score < CONTENT_CLUSTER_SCORE.categoryMatch) {
        return null;
      }

      return {
        score,
        publishedAt: toPublishedTimestamp(post.published_at),
        slug: post.slug,
        guide: {
          href: buildGuideHref(input.storeUrl, post.slug),
          title: post.title,
          description: buildCommercialGuideDescription(post),
          kind: inferred.kind,
        } satisfies InformationalGuideLink,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .filter((entry) => entry.score >= 4)
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.publishedAt - left.publishedAt ||
        left.slug.localeCompare(right.slug)
    )
    .slice(0, 3)
    .map((entry) => entry.guide);
}
