import { CONTENT_CLUSTER_SCORE } from '@/config/storefront-content-clusters';
import { generateSlug } from '@/lib/seo-utils';
import type {
  BuildCommercialGuideLinksInput,
  CommercialGuidePageKind,
  ContentClusterKind,
  InformationalGuideLink,
} from './content-cluster-types';
import { getProductModelIdentifiers } from './get-product-model-identifiers';
import { inferContentClusterContext } from './infer-content-cluster-context';

const KIND_PREFERENCE: Record<CommercialGuidePageKind, ContentClusterKind[]> = {
  category: ['buyer-guide', 'best-in-nigeria'],
  product: [],
  compare: ['decision-support', 'buyer-guide'],
  'price-band': ['best-in-nigeria', 'buyer-guide'],
};

function toPublishedTimestamp(value: string | null) {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function tokenizeSlug(slug: string) {
  return slug
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length > 2);
}

function tokenizeModelIdentifier(identifier: string) {
  return identifier
    .split(/[^a-z0-9]+/iu)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
}

function buildGuideHref(storeUrl: string, slug: string) {
  return `${storeUrl}/blog/${slug}`;
}

function buildGuideDescription(post: {
  excerpt: string | null;
  reading_time_minutes: number | null;
}) {
  const excerpt = post.excerpt?.trim();

  if (excerpt) {
    return excerpt;
  }

  return post.reading_time_minutes
    ? `${post.reading_time_minutes} minute guide`
    : 'Read the full guide';
}

export function buildCommercialGuideLinks(
  input: BuildCommercialGuideLinksInput
): InformationalGuideLink[] {
  const preferredKinds = KIND_PREFERENCE[input.context.pageKind];
  const productModelIdentifiers = getProductModelIdentifiers(input.context);
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
      if (
        normalizedBrands.length > 0 &&
        inferred.brands.some((brand) =>
          normalizedBrands.includes(generateSlug(brand))
        )
      ) {
        score += CONTENT_CLUSTER_SCORE.brandMatch;
      }

      if (
        input.context.priceBandSlug &&
        inferred.matchedPriceBands.includes(input.context.priceBandSlug)
      ) {
        score += CONTENT_CLUSTER_SCORE.priceBandMatch;
      }

      const hasProductModelMatch = productModelIdentifiers.some(
        (identifier) => {
          const identifierTokens = tokenizeModelIdentifier(identifier);
          return (
            identifierTokens.length > 0 &&
            identifierTokens.every((token) => inferred.tokens.includes(token))
          );
        }
      );
      const hasModelFamilyMatch =
        modelFamilyTokens.length > 0 &&
        modelFamilyTokens.every((token) => inferred.tokens.includes(token));
      if (hasProductModelMatch || hasModelFamilyMatch) {
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
          description: buildGuideDescription(post),
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
