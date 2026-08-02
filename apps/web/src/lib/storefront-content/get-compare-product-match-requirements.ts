import { CONTENT_CLUSTER_SUPPORT } from '@/config/storefront-content-clusters';
import { generateSlug } from '@/lib/seo-utils';
import type { BuildCommercialGuideLinksContext } from './content-cluster-types';
import { getProductModelIdentifiers } from './get-product-model-identifiers';
import { normalizeContentCurrencyTokens } from './normalize-content-currency-tokens';

type CompareProductMatchRequirement = {
  identifier: string;
  brand: string | null;
  discriminatorTokens?: string[];
};

const VARIANT_DISCRIMINATOR_PATTERN =
  /^(?:\d+(?:gb|tb|mb|mm|inch)|(?:e)?sim|wifi|cellular|lte|dual|single|physical|nano|active|classic|edge|fe|flip|fold|lite|max|mini|neo|plus|power|prime|pro|se|ultra|xl)$/u;
const SPLIT_VARIANT_UNIT_TOKENS = new Set(['gb', 'tb', 'mb', 'mm', 'inch']);

function tokenize(value: string) {
  return normalizeContentCurrencyTokens(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter(Boolean);
}

function tokenizeVariantSource(value: string) {
  const tokens = tokenize(value);
  const normalizedTokens: string[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index] ?? '';
    const nextToken = tokens[index + 1] ?? '';
    if (/^\d+$/u.test(token) && SPLIT_VARIANT_UNIT_TOKENS.has(nextToken)) {
      normalizedTokens.push(`${token}${nextToken}`);
      index += 1;
      continue;
    }
    normalizedTokens.push(token);
  }
  return normalizedTokens;
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
  return (
    getBrandCandidates(context).find(({ markers }) =>
      markers.some((marker) =>
        tokenize(marker).every((token) => sourceTokens.has(token))
      )
    )?.brand ?? null
  );
}

function getSourceDiscriminatorTokens(source: string, identifier: string) {
  const identifierTokens = new Set(tokenizeVariantSource(identifier));
  const seen = new Set<string>();
  const discriminatorTokens: string[] = [];
  for (const token of tokenizeVariantSource(source)) {
    if (
      !identifierTokens.has(token) &&
      VARIANT_DISCRIMINATOR_PATTERN.test(token) &&
      !seen.has(token)
    ) {
      seen.add(token);
      discriminatorTokens.push(token);
    }
  }
  return discriminatorTokens;
}

function isNumericOnlyIdentifier(identifier: string) {
  const tokens = tokenize(identifier);
  return tokens.length > 0 && tokens.every((token) => /^\d+$/u.test(token));
}

/** Builds per-product compare requirements without collapsing brand collisions. */
export function getCompareProductMatchRequirements(
  context: BuildCommercialGuideLinksContext
) {
  const names = context.productNames ?? [];
  const slugs = context.productSlugs ?? [];
  const sources = (names.length ? names : slugs).map((source, index) => ({
    identifierSource: source,
    brandSource: `${source} ${slugs[index] ?? ''}`,
  }));

  const candidates = sources.flatMap(({ identifierSource, brandSource }) => {
    const identifier = getProductModelIdentifiers({
      ...context,
      productNames: names.length ? [identifierSource] : undefined,
      productSlugs: names.length ? [] : [identifierSource],
    })[0];

    return identifier
      ? [
          {
            identifier,
            brand: inferSourceBrand(brandSource, context),
            discriminatorTokens: getSourceDiscriminatorTokens(
              brandSource,
              identifier
            ),
          },
        ]
      : [];
  });

  const brandsByIdentifier = new Map<string, Set<string>>();
  for (const candidate of candidates) {
    if (!candidate.brand) {
      continue;
    }
    const brands = brandsByIdentifier.get(candidate.identifier) ?? new Set();
    brands.add(candidate.brand);
    brandsByIdentifier.set(candidate.identifier, brands);
  }

  const candidateCounts = new Map<string, number>();
  for (const candidate of candidates) {
    const key = `${candidate.identifier}\u0000${candidate.brand ?? ''}`;
    candidateCounts.set(key, (candidateCounts.get(key) ?? 0) + 1);
  }
  const candidateGroups = new Map<string, typeof candidates>();
  for (const candidate of candidates) {
    const key = `${candidate.identifier}\u0000${candidate.brand ?? ''}`;
    const group = candidateGroups.get(key) ?? [];
    group.push(candidate);
    candidateGroups.set(key, group);
  }

  return candidates
    .map((candidate) => {
      const key = `${candidate.identifier}\u0000${candidate.brand ?? ''}`;
      const requirement: CompareProductMatchRequirement = {
        identifier: candidate.identifier,
        brand:
          isNumericOnlyIdentifier(candidate.identifier) ||
          (brandsByIdentifier.get(candidate.identifier)?.size ?? 0) > 1
            ? candidate.brand
            : null,
      };
      if ((candidateCounts.get(key) ?? 0) > 1) {
        const group = candidateGroups.get(key) ?? [];
        const discriminatorTokens = candidate.discriminatorTokens.filter(
          (token) =>
            group
              .filter((other) => other !== candidate)
              .every((other) => !other.discriminatorTokens.includes(token))
        );
        if (discriminatorTokens.length > 0) {
          requirement.discriminatorTokens = discriminatorTokens;
        }
      }
      return requirement;
    })
    .filter(
      (candidate, index, all) =>
        all.findIndex(
          (other) =>
            other.identifier === candidate.identifier &&
            other.brand === candidate.brand &&
            other.discriminatorTokens?.join('\u0000') ===
              candidate.discriminatorTokens?.join('\u0000')
        ) === index
    );
}
