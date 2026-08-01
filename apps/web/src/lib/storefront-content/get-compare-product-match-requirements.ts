import { CONTENT_CLUSTER_SUPPORT } from '@/config/storefront-content-clusters';
import { generateSlug } from '@/lib/seo-utils';
import type { BuildCommercialGuideLinksContext } from './content-cluster-types';
import { getProductModelIdentifiers } from './get-product-model-identifiers';
import { normalizeContentCurrencyTokens } from './normalize-content-currency-tokens';

function tokenize(value: string) {
  return normalizeContentCurrencyTokens(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter(Boolean);
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

  return candidates
    .map((candidate) => ({
      identifier: candidate.identifier,
      brand:
        (brandsByIdentifier.get(candidate.identifier)?.size ?? 0) > 1
          ? candidate.brand
          : null,
    }))
    .filter(
      (candidate, index, all) =>
        all.findIndex(
          (other) =>
            other.identifier === candidate.identifier &&
            other.brand === candidate.brand
        ) === index
    );
}
