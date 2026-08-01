import { CONTENT_CLUSTER_SCORE } from '@/config/storefront-content-clusters';
import { generateSlug } from '@/lib/seo-utils';
import { buildCommercialGuideDescription } from './build-commercial-guide-description';
import type {
  BuildCommercialGuideLinksInput,
  CommercialGuidePageKind,
  ContentClusterKind,
  InformationalGuideLink,
} from './content-cluster-types';
import { countCleanIdentifierOccurrences } from './count-clean-identifier-occurrences';
import { getCompareProductMatchRequirements } from './get-compare-product-match-requirements';
import { getProductModelIdentifiers } from './get-product-model-identifiers';
import { inferContentClusterContext } from './infer-content-cluster-context';
import { normalizeContentCurrencyTokens } from './normalize-content-currency-tokens';

const KIND_PREFERENCE: Record<CommercialGuidePageKind, ContentClusterKind[]> = {
  category: ['buyer-guide', 'best-in-nigeria'],
  product: [],
  compare: ['decision-support', 'buyer-guide'],
  'price-band': ['best-in-nigeria', 'buyer-guide'],
};

const MODEL_FAMILY_CONTEXT_EXCLUSIONS = new Set(['and', 'or']);

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

function tokenizeText(value: string | null | undefined) {
  return normalizeContentCurrencyTokens(value ?? '')
    .toLowerCase()
    .replace(/[’']s\b/gu, '')
    .replace(/\+/gu, ' plus ')
    .split(/[^a-z0-9]+/iu)
    .map((token) => token.trim())
    .filter(Boolean);
}

function hasContiguousTokenSequence(
  post: BuildCommercialGuideLinksInput['posts'][number],
  expectedTokens: string[]
) {
  const postTokenGroups = [
    post.title,
    post.excerpt,
    post.category,
    ...(post.tags ?? []),
    ...(post.keywords ?? []),
  ].map(tokenizeText);

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
  minimumOccurrences = 1
) {
  if (
    identifierTokens.length === 0 ||
    (identifierTokens.every((token) => /^\d+$/u.test(token)) &&
      !hasBrandMatch) ||
    !identifierTokens.every((token) => inferredTokens.includes(token))
  ) {
    return false;
  }

  return (
    countCleanIdentifierOccurrences(post, identifierTokens) >=
    minimumOccurrences
  );
}

function hasContextualSingleTokenFamilyMatch(
  post: BuildCommercialGuideLinksInput['posts'][number],
  familyToken: string,
  brands: string[]
) {
  const brandTokens = brands
    .flatMap(tokenizeText)
    .filter(
      (token) => token.length > 1 && !MODEL_FAMILY_CONTEXT_EXCLUSIONS.has(token)
    );

  return brandTokens.some(
    (brandToken) =>
      hasContiguousTokenSequence(post, [brandToken, familyToken]) ||
      hasContiguousTokenSequence(post, [familyToken, brandToken])
  );
}

function buildGuideHref(storeUrl: string, slug: string) {
  return `${storeUrl}/blog/${slug}`;
}

export function buildCommercialGuideLinks(
  input: BuildCommercialGuideLinksInput
): InformationalGuideLink[] {
  const preferredKinds = KIND_PREFERENCE[input.context.pageKind];
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
      const hasBrandMatch =
        normalizedBrands.length > 0 &&
        inferred.brands.some((brand) =>
          normalizedBrands.includes(generateSlug(brand))
        );
      if (hasBrandMatch) {
        score += CONTENT_CLUSTER_SCORE.brandMatch;
      }

      if (
        input.context.priceBandSlug &&
        inferred.matchedPriceBands.includes(input.context.priceBandSlug)
      ) {
        score += CONTENT_CLUSTER_SCORE.priceBandMatch;
      }

      const hasProductModelMatch = productModelIdentifiers.some((identifier) =>
        matchesProductIdentifier(
          post,
          inferred.tokens,
          tokenizeModelIdentifier(identifier),
          hasBrandMatch
        )
      );
      const hasModelFamilyMatch =
        modelFamilyTokens.length > 0 &&
        hasBrandMatch &&
        modelFamilyTokens.every((token) => inferred.tokens.includes(token)) &&
        (modelFamilyTokens.length === 1
          ? hasContextualSingleTokenFamilyMatch(
              post,
              modelFamilyTokens[0] ?? '',
              input.context.brands ?? []
            )
          : hasContiguousTokenSequence(post, modelFamilyTokens));
      const hasRequiredCompareModelMatch =
        input.context.pageKind === 'compare' &&
        compareProductMatchRequirements.length > 0 &&
        compareProductMatchRequirements.every(
          ({ identifier, brand, occurrence }) =>
            (!brand || inferred.brands.includes(brand)) &&
            matchesProductIdentifier(
              post,
              inferred.tokens,
              tokenizeModelIdentifier(identifier),
              hasBrandMatch,
              occurrence
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
