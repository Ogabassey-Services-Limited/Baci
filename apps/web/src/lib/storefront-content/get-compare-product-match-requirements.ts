import { CONTENT_CLUSTER_SUPPORT } from '@/config/storefront-content-clusters';
import { generateSlug } from '@/lib/seo-utils';
import type { BuildCommercialGuideLinksContext } from './content-cluster-types';
import { getProductGuideModelIdentifiers } from './get-product-guide-model-identifiers';
import { isProductVariantColorToken } from './is-product-variant-color-token';
import { normalizeContentCurrencyTokens } from './normalize-content-currency-tokens';
import { normalizeVariantDiscriminatorTokens } from './normalize-variant-discriminator-tokens';

type CompareProductMatchRequirement = {
  identifier: string;
  brand: string | null;
  discriminatorTokens?: string[];
};

const VARIANT_DISCRIMINATOR_PATTERN =
  /^(?:\d+(?:g|gb|tb|mb|mm|inch)|(?:e)?sim|bluetooth|wifi|cellular|gps|lte|dual|single|physical|nano|active|classic|edge|fe|flip|fold|lite|max|mini|neo|plus|power|prime|pro|se|ultra|xl)$/u;

function tokenize(value: string) {
  return normalizeContentCurrencyTokens(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter(Boolean);
}

function tokenizeVariantSource(value: string) {
  return normalizeVariantDiscriminatorTokens(tokenize(value));
}

function getBrandCandidates(context: BuildCommercialGuideLinksContext) {
  const configured = Object.entries(
    CONTENT_CLUSTER_SUPPORT[context.categorySlug].brandTokens
  ).map(([brand, aliases]) => ({
    brand,
    markers: [brand, ...aliases],
  }));

  return [
    ...configured,
    ...(context.brands ?? []).map((brand) => ({
      brand: generateSlug(brand),
      markers: [brand],
    })),
  ];
}

function inferSourceBrand(
  source: string,
  context: BuildCommercialGuideLinksContext
) {
  const sourceTokens = new Set(tokenize(source));
  const candidates = getBrandCandidates(context);
  return (
    candidates.find(({ brand }) =>
      tokenize(brand).every((token) => sourceTokens.has(token))
    )?.brand ??
    candidates.find(({ markers }) =>
      markers.some((marker) =>
        tokenize(marker).every((token) => sourceTokens.has(token))
      )
    )?.brand ??
    null
  );
}

function getSourceDiscriminatorTokens(source: string, identifier: string) {
  const identifierTokens = new Set(tokenizeVariantSource(identifier));
  const seen = new Set<string>();
  const discriminatorTokens: string[] = [];
  for (const token of tokenizeVariantSource(source)) {
    if (
      !identifierTokens.has(token) &&
      (VARIANT_DISCRIMINATOR_PATTERN.test(token) ||
        isProductVariantColorToken(token)) &&
      !seen.has(token)
    ) {
      seen.add(token);
      discriminatorTokens.push(token);
    }
  }
  return discriminatorTokens;
}

function getMostSpecificProductIdentifier(
  context: BuildCommercialGuideLinksContext
) {
  return getProductGuideModelIdentifiers(context).reduce<string | undefined>(
    (mostSpecific, identifier) =>
      !mostSpecific ||
      tokenize(identifier).length > tokenize(mostSpecific).length
        ? identifier
        : mostSpecific,
    undefined
  );
}

/** Builds per-product compare requirements without collapsing brand collisions. */
export function getCompareProductMatchRequirements(
  context: BuildCommercialGuideLinksContext
) {
  const names = context.productNames ?? [];
  const slugs = context.productSlugs ?? [];
  const sources = (names.length ? names : slugs).map((source, index) => ({
    identifierSource: source,
    pairedSlug: slugs[index],
    brandSource: `${context.productBrands?.[index] ?? ''} ${source} ${slugs[index] ?? ''}`,
    variantSource: `${source} ${names.length ? (slugs[index] ?? '') : ''}`,
    hasExplicitVariantSource: names.length > 0,
  }));

  const candidates = sources.flatMap(
    ({
      identifierSource,
      pairedSlug,
      brandSource,
      variantSource,
      hasExplicitVariantSource,
    }) => {
      const identifier = getMostSpecificProductIdentifier({
        ...context,
        productNames: names.length ? [identifierSource] : undefined,
        productSlugs: names.length
          ? pairedSlug
            ? [pairedSlug]
            : []
          : [identifierSource],
      });

      return identifier
        ? [
            {
              identifier,
              brand: inferSourceBrand(brandSource, context),
              discriminatorTokens: getSourceDiscriminatorTokens(
                variantSource,
                identifier
              ),
              hasExplicitVariantSource,
            },
          ]
        : [];
    }
  );

  if (candidates.length !== sources.length) {
    return [];
  }

  const candidateGroups = new Map<string, typeof candidates>();
  for (const candidate of candidates) {
    const key = `${candidate.identifier}\u0000${candidate.brand ?? ''}`;
    candidateGroups.set(key, [...(candidateGroups.get(key) ?? []), candidate]);
  }

  return candidates.map((candidate) => {
    const key = `${candidate.identifier}\u0000${candidate.brand ?? ''}`;
    const group = candidateGroups.get(key) ?? [];
    const requirement: CompareProductMatchRequirement = {
      identifier: candidate.identifier,
      brand: candidate.brand,
    };
    const hasSubsetVariants = group.some((left) =>
      group.some(
        (right) =>
          left !== right &&
          left.discriminatorTokens.length < right.discriminatorTokens.length &&
          left.discriminatorTokens.every((token) =>
            right.discriminatorTokens.includes(token)
          )
      )
    );
    const discriminatorTokens =
      (group.length === 1 && candidate.hasExplicitVariantSource) ||
      hasSubsetVariants
        ? candidate.discriminatorTokens
        : group.length > 1
          ? candidate.discriminatorTokens.filter((token) =>
              group
                .filter((other) => other !== candidate)
                .every((other) => !other.discriminatorTokens.includes(token))
            )
          : [];
    if (discriminatorTokens.length > 0) {
      requirement.discriminatorTokens = discriminatorTokens;
    }
    return requirement;
  });
}
